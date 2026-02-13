---
name: kintone-restart-workflow
description: 既存kintoneアプリの読み込み→可視化→変更計画→適用を行う協調修正ワークフロー。Phase R1〜R4のフローをオーケストレーションする。
---

# kintone リスタートワークフロー

既存kintoneアプリを読み込み、変更を計画・適用する協調修正ワークフロー。メインエージェントはオーケストレーターに徹し、各フェーズをサブエージェント（Task tool）に委譲する。

## 概要

| フェーズ | 内容 | サブエージェント | 出力 |
|---------|------|----------------|------|
| Step 0 | アプリ選択 | オーケストレーター | TargetAppIds |
| Phase R1 | リバースエンジニアリング | `kintone-reverse-engineer` | 現状分析書 |
| Phase R2 | 変更計画作成 | `kintone-change-planner` | 変更計画書 |
| Phase R3 | 詳細設計更新 | `kintone-design-updater` | アプリ設計書、フィールド設計書 |
| Phase R4 | 変更適用 | `kintone-updater` / `kintone-customizer` | deployment_result.json |

各フェーズ前にチェックポイント（HITL）あり。

## コンテキスト受け渡し

フェーズ間の情報はファイル参照で受け渡す（メインコンテキストに蓄積しない）:

| 受け渡し | ファイル |
|---------|--------|
| Step 0 → R1 | スペースID、ユーザーが選択したアプリID一覧（`${TargetAppIds}`）をpromptで渡す |
| R1 → R2 | `outputs/${Project}/現状分析_${Project}_${Date}.md` |
| R2 → R3 | `outputs/${Project}/変更計画_${Project}_${Date}.md` + `現状分析_${Project}_${Date}.md` |
| R3 → R4 | `outputs/${Project}/アプリ設計書_${Project}_${Date}.md` + `フィールド設計書_${Project}_${Date}.md` |
| R4 → feedback | `outputs/${Project}/deployment_result_${Date}.json` |

## 実行フロー

```
Step 0: プロジェクト情報 + スペースID入力 + Pre-flight Check + アプリ選択
  ↓
Phase R1: Task(kintone-reverse-engineer) → リバースエンジニアリング
  ↓
Checkpoint R1: ER図表示 + 現状確認（HITL）
  ↓
Phase R2: Task(kintone-change-planner) → 変更計画作成
  ↓
Checkpoint R2: 変更差分プレビュー + 更新ER図（HITL）
  ↓
Phase R3: Task(kintone-design-updater) → 詳細設計更新
  ↓
Checkpoint R3: 統合レビュー + 最終確認（HITL）
  ↓
Phase R4:
  R4a: Task(kintone-updater) → フィールド・関係・レイアウト・ビュー変更適用
  R4b: Task(kintone-customizer) → カスタマイズ変更（変更がある場合のみ）
  ↓
Step 5d: フィードバック収集（R2/R3/R4に戻るルーティング）
```

## Step 0: プロジェクト情報確定 + アプリ選択（メインエージェント直接実行）

### Step 0-1: プロジェクト情報

1. プロジェクト名を確認（AskUserQuestion）
2. 日付変数を確定: `${Date}` = YYYYMMDD形式
3. 出力先ディレクトリ: `outputs/${Project}/`
4. 出力ディレクトリを作成

### Step 0-2: スペースID入力

1. AskUserQuestion でスペースIDをテキスト入力させる
   - 「変更対象のアプリが含まれるスペースのIDを入力してください」
   - ※ スペースIDは任意の数値のため選択肢形式は使わない

### Step 0-3: Pre-flight Check

```bash
set -a && source .env && set +a

if [ -z "$KINTONE_DOMAIN" ] || [ -z "$KINTONE_USERNAME" ] || [ -z "$KINTONE_PASSWORD" ]; then
  echo "環境変数が設定されていません。.envファイルを確認してください。"
  exit 1
fi

AUTH=$(echo -n "${KINTONE_USERNAME}:${KINTONE_PASSWORD}" | base64)

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "${KINTONE_DOMAIN}/k/v1/apps.json?limit=1" \
  -H "X-Cybozu-Authorization: ${AUTH}")

if [ "$RESPONSE" != "200" ]; then
  echo "kintone接続エラー (HTTP $RESPONSE)"
  exit 1
fi

echo "kintone接続確認完了"
```

### Step 0-4: スペース内アプリ一覧取得

```bash
curl -s "${KINTONE_DOMAIN}/k/v1/apps.json" \
  -H "X-Cybozu-Authorization: ${AUTH}" \
  -G --data-urlencode "spaceIds[0]=${SPACE_ID}" --data-urlencode "limit=100"
```

※ APIパラメータ形式は配列形式 `spaceIds[0]=X` を使用。実行時にkintone APIドキュメントで正確な形式を確認すること。

### Step 0-5: アプリ選択

取得したアプリ一覧をテーブル表示:

```
スペース内のアプリ一覧:
| No | アプリID | アプリ名         | 作成日     |
|----|---------|----------------|-----------|
| 1  | 123     | 顧客マスタ       | 2026-01-15 |
| 2  | 124     | 商品マスタ       | 2026-01-15 |
| 3  | 125     | 受注管理        | 2026-01-16 |
| 4  | 126     | 在庫管理        | 2026-02-01 |
```

**アプリ数に応じた選択方法**:

- **4個以下**: AskUserQuestion（multiSelect: true）で選択
  - 選択肢: 各アプリ名 + 「全てのアプリ」
- **5個以上**: テキスト入力で番号指定
  - 「対象アプリの番号をカンマ区切りで入力してください（例: 1,2,3 または all）」

### Step 0-6: 変数確定

- `${TargetAppIds}`: 選択されたアプリIDの配列（仮確定、R1で依存アプリ追加の可能性あり）
- `${SpaceId}`: スペースID
- `${Project}`: プロジェクト名
- `${Date}`: YYYYMMDD
- `${OutputDir}`: `outputs/${Project}/`

Phase R1に進む。

## Phase R1: リバースエンジニアリング

### Task起動

```
Task(kintone-reverse-engineer):
  prompt: |
    以下の手順で既存kintoneアプリのリバースエンジニアリングを行ってください。

    ## プロジェクト情報
    - プロジェクト名: ${Project}
    - 日付: ${Date}
    - 出力先: ${OutputDir}
    - スペースID: ${SpaceId}

    ## ターゲットアプリ
    ${TargetAppIds のアプリID一覧}

    ## 手順
    1. `.claude/skills/kintone-reverse-engineering/SKILL.md` を読んで手順を確認
    2. `templates/current-state-template.md` を読んでテンプレートを確認
    3. Pre-flight Check を実行
    4. 各ターゲットアプリのAPI情報を取得（Step R1-1）
    5. 依存アプリの検出（Step R1-2）— 未選択の依存アプリがあれば結果に明記
    6. フィールド分類・関係グラフ構築（Step R1-3）
    7. 現状分析書を生成

    ## 出力ファイル
    - ${OutputDir}現状分析_${Project}_${Date}.md
```

### 依存アプリの追加確認（メインエージェント直接実行）

Phase R1のTask結果を確認し、依存アプリ情報が含まれる場合:

1. 未選択の依存アプリ一覧を表示
2. AskUserQuestion: 「${アプリA} が参照している ${アプリC}（ID: ${ID}）も対象に追加しますか？」
3. 追加承認 → `${TargetAppIds}` を更新し、Phase R1を**追加分のみ**再起動
4. 追加拒否 → 現状分析書に「対象外」として記載

### Checkpoint R1（メインエージェント直接実行）

**コンセプト**: ER図で現状を可視化する。テキストではなく図をベースに確認を行う。

1. `現状分析_*.md` をReadで確認
2. **draw.io でER図を表示**:
   - 現状分析書の「## 2. ER図」セクションから ` ```mermaid ` ～ ` ``` ` ブロックを抽出
   - `open_drawio_mermaid` MCPツールに抽出したMermaidテキストを `content` パラメータとして渡す
   - ※ drawio MCPが利用不可の場合はMarkdown上のMermaidテキストで代替
   - 例:
     ```
     open_drawio_mermaid(content: "erDiagram\n    顧客マスタ ||--o{ 受注管理 : \"顧客ルックアップ\"\n    ...")
     ```
3. ユーザーにサマリを表示:
   - 「draw.io にER図を表示しました。ブラウザで確認してください」
   - アプリ一覧テーブル（現状分析書の「## 1. アプリ一覧」をそのまま表示）
   - 関係テーブル（「## 4. 関係詳細」のルックアップ + 関連レコード一覧をそのまま表示）
   - カスタマイズ状況一覧（各アプリのJS/CSSファイル数）
4. AskUserQuestion: 「現状を確認しました。何を変更したいですか？」
5. ユーザーの変更要望を収集 → Phase R2へ

## Phase R2: 変更計画作成

### Task起動

```
Task(kintone-change-planner):
  prompt: |
    以下の手順で変更計画を作成してください。

    ## プロジェクト情報
    - プロジェクト名: ${Project}
    - 日付: ${Date}
    - 出力先: ${OutputDir}

    ## インプット（最初に読み込むこと）
    - ${OutputDir}現状分析_${Project}_${Date}.md

    ## ユーザーの変更要望
    ${Checkpoint R1 で収集した変更要望}

    ## 手順
    1. 上記のインプットファイルを読み込む
    2. `.claude/skills/kintone-change-planning/SKILL.md` を読んで手順を確認
    3. `templates/change-plan-template.md` を読んでテンプレートを確認
    4. ユーザーの変更要望を具体的な変更操作に分解
    5. 必要に応じてAskUserQuestionで詳細を確認
    6. リスク評価
    7. 3-Pass適用順序を計画
    8. 変更計画書を生成

    ## 出力ファイル
    - ${OutputDir}変更計画_${Project}_${Date}.md
```

### Checkpoint R2（メインエージェント直接実行）

**コンセプト**: 変更後のER図で合意形成する。現状 → 変更後の差分を視覚的に確認する。

1. `変更計画_*.md` をReadで確認
2. 差分プレビュー表示（+ ADD / ~ MODIFY / - DELETE 形式）:
   ```
   ## 変更差分プレビュー

   ### 顧客マスタ
   + ADD: email (メールアドレス, SINGLE_LINE_TEXT)
   ~ MODIFY: status (選択肢追加: "保留")
   - DELETE: phone_old (旧電話番号)

   ### [新規] 活動履歴
   + ADD: activity_id (活動ID, SINGLE_LINE_TEXT, PK)
   + ADD: customer_lookup (顧客, LOOKUP → 顧客マスタ)
   ...
   ```
3. **draw.io で更新後ER図を表示**:
   - 変更計画書の「## 5. 更新後ER図」セクションから ` ```mermaid ` ～ ` ``` ` ブロックを抽出
   - `open_drawio_mermaid` MCPツールに抽出したMermaidテキストを `content` パラメータとして渡す
   - ※ drawio MCPが利用不可の場合はMarkdown上のMermaidテキストで代替
   - 例:
     ```
     open_drawio_mermaid(content: "erDiagram\n    顧客マスタ ||--o{ 受注管理 : \"顧客ルックアップ\"\n    顧客マスタ ||--o{ 活動履歴 : \"顧客ルックアップ\"\n    ...")
     ```
4. リスク評価テーブルを表示（変更計画書の「## 3. リスク評価」）
5. AskUserQuestion: 「draw.ioでER図を確認してください。変更計画を承認しますか？修正があれば教えてください」
   - 承認 → Phase R3へ
   - 修正あり → 以下どちらも受け付ける（混在OK）:
     - **自然言語で伝える** → 修正内容をpromptに含めてPhase R2を再起動
     - **draw.ioで直接編集** → `.claude/skills/drawio-diff/SKILL.md` の `er` モードで差分検出:
       1. Playwright MCPの `browser_evaluate` でdraw.ioから変更後のER構造を抽出
       2. `scripts/drawio-pull.js` の `EXTRACT_ER_DIAGRAM` ロジックでテーブル・フィールド・エッジを取得
       3. 抽出結果と変更計画書のER図を比較して差分を特定
       4. 差分を変更計画書に反映（Mermaid ER図を更新）
   - → `open_drawio_mermaid` で更新後のER図を再表示 → Checkpoint R2 に戻る

## Phase R3: 詳細設計更新

### Task起動

```
Task(kintone-design-updater):
  prompt: |
    以下の手順で設計書を生成・更新してください。

    ## プロジェクト情報
    - プロジェクト名: ${Project}
    - 日付: ${Date}
    - 出力先: ${OutputDir}

    ## インプット（最初に全て読み込むこと）
    - ${OutputDir}現状分析_${Project}_${Date}.md
    - ${OutputDir}変更計画_${Project}_${Date}.md

    ## 手順
    1. 上記のインプットファイルを全て読み込む
    2. `.claude/skills/kintone-app-design/SKILL.md` を読んでアプリ設計の形式を確認
    3. `.claude/skills/kintone-field-design/SKILL.md` を読んでフィールド設計の形式を確認
    4. 現状分析書の全アプリフィールド定義に、変更計画のADD/MODIFY/DELETEを反映
    5. 新規アプリがある場合は完全なフィールド設計を新規作成
    6. アプリ設計書を生成（接続図、デプロイ順序含む）
    7. フィールド設計書を生成（全アプリの全フィールド、レイアウト、カスタマイズ設計含む）

    ## 出力ファイル
    - ${OutputDir}アプリ設計書_${Project}_${Date}.md
    - ${OutputDir}フィールド設計書_${Project}_${Date}.md
```

### Checkpoint R3（メインエージェント直接実行）

#### 統合レビュー（/restart専用チェックリスト）

以下のチェックリストをメインエージェントが直接実行:

**1. 変更計画 × 設計書の整合性チェック**:
- [ ] 変更計画の全項目がアプリ設計書・フィールド設計書に反映されているか
- [ ] 新規アプリのフィールド定義が完全か（PK、FK、基本フィールド全て）
- [ ] 変更種別（ADD/MODIFY/DELETE）と設計書の記載が一致するか

**2. 関係整合性チェック**:
- [ ] ルックアップのキーフィールドに `unique: true` が設定されているか
- [ ] 新規ルックアップの参照先アプリがデプロイ済み（既存）or デプロイ予定（新規）か
- [ ] 循環参照がないか
- [ ] 関連レコード一覧の条件フィールドが存在するか

**3. リスク確認チェック**:
- [ ] DELETE操作が明示的に確認済みか
- [ ] フィールドタイプ変更が含まれていないか（kintone制約）
- [ ] サブテーブル変更が全体再定義で計画されているか

**4. デプロイ計画チェック**:
- [ ] 3-Passの適用順序が依存関係を満たすか
- [ ] 新規アプリのデプロイが既存アプリの関係変更より先か

#### 判定

- CRITICAL = 0 → Phase R4に進行可
- CRITICAL > 0 → 修正してCheckpoint R3に戻る

#### 手順

1. 上記チェックリストを実行
2. `統合レビュー_${Project}_${Date}.md` を生成
3. CRITICAL = 0 確認
4. デプロイ計画表示（3-Pass方式）
5. AskUserQuestion: 「Phase R4（変更適用）に進んでよろしいですか？」
   - 進む → Phase R4へ
   - 修正する → 修正内容を聞いてPhase R3を再起動

## Phase R4: 変更適用

### Step R4a: フィールド・関係・レイアウト・ビュー変更

```
Task(kintone-updater):
  prompt: |
    以下の手順でkintoneアプリに変更を適用してください。

    ## プロジェクト情報
    - プロジェクト名: ${Project}
    - 日付: ${Date}
    - 出力先: ${OutputDir}
    - スペースID: ${SpaceId}

    ## インプット（最初に全て読み込むこと）
    - ${OutputDir}アプリ設計書_${Project}_${Date}.md
    - ${OutputDir}フィールド設計書_${Project}_${Date}.md
    - ${OutputDir}変更計画_${Project}_${Date}.md

    ## 手順
    1. 上記のインプットファイルを全て読み込む
    2. `.claude/skills/kintone-app-update/SKILL.md` を読んで更新手順を確認
    3. Pre-flight Check を実行
    4. 3-Pass アップデートデプロイを実行
       - Pass U1: 基本フィールド変更
       - Pass U2: 新規アプリ + 関係変更
       - Pass U3: レイアウト・ビュー・プロセス管理
    5. deployment_result.json を生成（カスタマイズは次ステップ）

    ## 出力ファイル
    - ${OutputDir}deployment_result_${Date}.json
```

### Step R4b: カスタマイズ変更（条件付き）

#### 実行判定（メインエージェント直接実行）

1. 変更計画書からカスタマイズ変更の有無を確認
2. カスタマイズ変更なし → Step 5dへスキップ
3. カスタマイズ変更あり → Task起動

```
Task(kintone-customizer):
  prompt: |
    以下の手順でkintoneアプリにカスタマイズを適用してください。

    ## プロジェクト情報
    - プロジェクト名: ${Project}
    - 日付: ${Date}
    - 出力先: ${OutputDir}

    ## インプット（最初に全て読み込むこと）
    - ${OutputDir}フィールド設計書_${Project}_${Date}.md（カスタマイズ設計セクション）
    - ${OutputDir}deployment_result_${Date}.json（アプリID参照）
    - ${OutputDir}変更計画_${Project}_${Date}.md（カスタマイズ変更セクション）

    ## 重要: 既存カスタマイズの保持
    - 変更計画で言及されていないカスタマイズは既存のfileKeyをそのまま保持
    - 新規追加分のみ生成・アップロード・適用

    ## 手順
    1. 上記のインプットファイルを全て読み込む
    2. `.claude/skills/kintone-customize/SKILL.md` を読んでカスタマイズ手順を確認
    3. deployment_result.jsonからアプリIDを取得
    4. 既存カスタマイズを確認（GET /k/v1/app/customize.json）
    5. 新規カスタマイズのみ生成・適用（既存は保持）
    6. deployment_result.json の customizations 配列を更新

    ## 出力
    - カスタマイズJSファイル（${OutputDir}）
    - deployment_result_${Date}.json の customizations 更新
```

### Step 5d: フィードバック収集

**重要**: Phase R4完了後、まず完了レポートを表示し、その後フィードバックを収集する。

1. `deployment_result_${Date}.json` をReadで読み込み
2. 完了レポートを表示:
   - 変更適用結果サマリ
   - 既存アプリの変更一覧（各操作のSUCCESS/FAILED）
   - 新規アプリ一覧（URL付き）
   - カスタマイズ適用結果
   - エラーがあれば表示
3. AskUserQuestion: 「アプリを触ってみて、フィードバックがあれば教えてください。問題なければ『完了』と入力してください」
   - 完了 → ワークフロー終了
   - フィードバックあり → フィードバック処理へ

#### フィードバック処理

1. フィードバック内容をヒアリング
2. `フィードバック_${Project}_${Date}_01.md` を生成（テンプレート: `templates/feedback-template.md`）
3. 影響判定と戻り先ルーティング:

| フィードバック内容 | 戻り先 |
|-----------------|--------|
| フィールド追加・変更・アプリ追加・関係変更 | Phase R2（変更計画再作成） |
| 設計書の記載ミス・フィールド定義の微修正 | Phase R3（設計書更新） |
| デプロイ設定・カスタマイズ修正のみ | Phase R4（該当パスのみ再実行） |

**重要**: `/start` への誘導はしない。全て `/restart` フロー内で完結する。

4. 該当フェーズを再起動

## HITL間の修正対応

ユーザーが修正を要求した場合の対応:

1. 修正内容をヒアリング（メインエージェント）
2. 同じsubagent_typeのサブエージェントを**新規起動**
3. promptに「既存ファイルを読み込んで修正箇所のみ変更」と指示
4. 修正後、Checkpointに戻る

## エラーハンドリング

### サブエージェントがエラーで終了した場合

1. エラー内容をユーザーに表示
2. AskUserQuestion: 「再試行しますか？」
   - はい → 同じサブエージェントを再起動
   - いいえ → ワークフロー中断

### Phase R4 デプロイ失敗時

1. deployment_result.json の errors 配列を確認
2. エラー内容をユーザーに表示
3. `.claude/skills/kintone-error-handbook/SKILL.md` を参照してエラー対処
4. 修正可能な場合は設計書修正 → 再デプロイ

### kintone接続エラー

1. Pre-flight Check 失敗時はPhase R1に進まない
2. `.env` の設定確認を促す

## 出力ファイル

すべて `outputs/${Project}/` に保存：
- `現状分析_${Project}_${Date}.md`
- `変更計画_${Project}_${Date}.md`
- `アプリ設計書_${Project}_${Date}.md`
- `フィールド設計書_${Project}_${Date}.md`
- `統合レビュー_${Project}_${Date}.md`
- `deployment_result_${Date}.json`
- `フィードバック_${Project}_${Date}_*.md`（フィードバック時のみ）

## 注意事項

1. **HITL必須**: 各Checkpoint（R1, R2, R3）の確認はスキップ不可
2. **既存アプリ修正 + 新規アプリ追加**: 両方に対応
3. **ロールバックなし**: デプロイ後の取り消しは手動対応（deployment_result.jsonで状態確認可能）
4. **カスタマイズ保持**: 変更計画外のJS/CSSは絶対に上書きしない
5. **フィードバックループ**: Step 5dで全て `/restart` フロー内で完結（`/start` への誘導なし）
6. **Phase 1/2ドキュメントは逆生成しない**: コンテキスト整理書・業務フロー設計書は作成しない。技術的な現状分析書のみ
