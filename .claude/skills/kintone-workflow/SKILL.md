---
name: kintone-workflow
description: kintoneアプリを作成する4フェーズワークフローを開始。対話形式で情報収集し、概要書→設計書→デプロイまでを支援。
---

# kintone ワークフロー

kintoneアプリを対話形式で作成するワークフロー。メインエージェントはオーケストレーターに徹し、各フェーズをサブエージェント（Task tool）に委譲する。

## 概要

| フェーズ | 内容 | サブエージェント | 出力 |
|---------|------|----------------|------|
| Phase 1 | 業務要件収集 → レビュー → 概要書生成 | `kintone-analyst` | システム概要書、機能要件書、業務フロー |
| Phase 2 | 概要書 → レビュー → 設計書生成（2ステップ） | `kintone-designer` | アプリ設計書、フィールド設計書 |
| Phase 3 | 設計書 → kintoneデプロイ（2-Pass 優先度順） | `kintone-deployer` | kintoneアプリ + deployment_result.json |
| Phase 3.5 | カスタマイズ適用（要件がある場合のみ） | `kintone-customizer` | JS/CSSファイル |
| Phase 4 | テストデータ投入（自動） | `kintone-deployer` | 各アプリ3件 |

各フェーズ前に確認プロセス（HITL）あり。

## コンテキスト受け渡し

フェーズ間の情報はファイル参照で受け渡す（メインコンテキストに蓄積しない）:

| 受け渡し | ファイル |
|---------|--------|
| Phase 1 → 2 | `outputs/${Project}/システム概要書_*.md`, `機能要件書_*.md`, `業務フロー_*.md` |
| Phase 2 → 3 | `outputs/${Project}/アプリ設計書_*.md`, `フィールド設計書_*.md` |
| Phase 3 → 3.5/4 | `outputs/${Project}/deployment_result_${Date}.json` |

## 実行フロー

```
Step 0: プロジェクト情報確定（メインエージェント）
  ↓
Step 1: Task(kintone-analyst) → Phase 1 ヒアリング+レビュー+概要書生成
  ↓
HITL #1: Phase 1 結果確認（メインエージェント）
  ↓
Step 2: Task(kintone-designer) → Phase 2 設計書生成
  ↓
HITL #2: Phase 2 結果確認 + 環境・スペース設定（メインエージェント）
  ↓
Step 3: Task(kintone-deployer) → Phase 3 デプロイ
  ↓
Step 4: Task(kintone-customizer) → Phase 3.5 カスタマイズ（条件付き）
  ↓
Step 5: Task(kintone-deployer) → Phase 4 テストデータ投入
  ↓
Step 6: 完了レポート表示（メインエージェント）
```

## Step 0: プロジェクト情報確定（メインエージェント直接実行）

1. プロジェクト名を推論・確認（AskUserQuestion）
2. 出力先ディレクトリ確認（デフォルト: `outputs/${Project}/`）
3. 日付変数を確定: `${Date}` = YYYYMMDD形式
4. 出力ディレクトリを作成

確定する変数:
- `${Project}`: プロジェクト名
- `${Date}`: 日付（YYYYMMDD）
- `${OutputDir}`: `outputs/${Project}/`

## Step 1: Phase 1 — ヒアリング＋概要書生成

### Task起動

```
Task(kintone-analyst):
  prompt: |
    以下の手順でkintoneシステムの要件収集と概要書生成を行ってください。

    ## プロジェクト情報
    - プロジェクト名: ${Project}
    - 日付: ${Date}
    - 出力先: ${OutputDir}

    ## 手順
    1. `.claude/skills/kintone-proposal/SKILL.md` を読んで生成手順を確認
    2. `.claude/skills/kintone-proposal-review/SKILL.md` を読んでレビュー手順を確認
    3. AskUserQuestionでユーザーから業務要件をヒアリング（セクションごとに分割）
    4. ユーザーが「以上です」と答えたらレビューを実行
    5. CRITICALな不足があれば追加質問→再レビュー
    6. 概要書を生成（3ファイル）

    ## 出力ファイル
    - ${OutputDir}システム概要書_${Project}_${Date}.md
    - ${OutputDir}機能要件書_${Project}_${Date}.md
    - ${OutputDir}業務フロー_${Project}_${Date}.md
```

### HITL #1（メインエージェント直接実行）

1. 生成された概要書の冒頭をReadで確認
2. ユーザーにサマリを表示:
   - 作成ドキュメント一覧
   - 主要な機能・アプリの概要
3. AskUserQuestion: 「Phase 2（設計書生成）に進んでよろしいですか？」
   - 進む → Step 2へ
   - 修正する → 修正内容を聞いてStep 1を再起動

## Step 2: Phase 2 — 設計書生成

### Task起動

```
Task(kintone-designer):
  prompt: |
    以下の手順でkintoneアプリ設計書とフィールド設計書を生成してください。

    ## プロジェクト情報
    - プロジェクト名: ${Project}
    - 日付: ${Date}
    - 出力先: ${OutputDir}

    ## インプット（最初に全て読み込むこと）
    - ${OutputDir}システム概要書_${Project}_${Date}.md
    - ${OutputDir}機能要件書_${Project}_${Date}.md
    - ${OutputDir}業務フロー_${Project}_${Date}.md

    ## 手順
    1. 上記のインプットファイルを全て読み込む
    2. `.claude/skills/kintone-app-design/SKILL.md` を読んでアプリ設計手順を確認
    3. `.claude/skills/kintone-field-design/SKILL.md` を読んでフィールド設計手順を確認
    4. `.claude/skills/kintone-design-review/SKILL.md` を読んでレビュー手順を確認
    5. インプットレビューを実行（CRITICALな不足があれば最終出力に不足リストとして記載）
    6. アプリ設計書を生成
    7. フィールド設計書を生成

    ## 出力ファイル
    - ${OutputDir}アプリ設計書_${Project}_${Date}.md
    - ${OutputDir}フィールド設計書_${Project}_${Date}.md
```

### HITL #2（メインエージェント直接実行）

1. 生成された設計書の冒頭をReadで確認
2. 不足リストが記載されていないかチェック
   - 不足リストあり → ユーザーに質問して回答を収集 → Step 2を再起動（回答を含めてpromptに追加）
3. ユーザーにサマリを表示:
   - アプリ一覧とフィールド数
   - アプリ間連携サマリ
   - カスタマイズ要件サマリ
4. AskUserQuestion: 「Phase 3（デプロイ）に進んでよろしいですか？」
   - 進む → 環境・スペース設定へ
   - 修正する → 修正内容を聞いてStep 2を再起動
5. 環境・スペース設定:
   - kintone接続確認（Pre-flight Check）
   - スペースID確認（既存スペース or ポータル直下）
   - **重要**: スペースIDは任意の数値が入りうるため、AskUserQuestionの選択肢形式は使わない。「ポータル直下 or 既存スペース」の選択後、既存スペースの場合はテキスト入力でスペースIDを取得する
   - `${SpaceId}` を確定

## Step 3: Phase 3 — デプロイ

### Task起動

```
Task(kintone-deployer):
  prompt: |
    以下の手順でkintoneにアプリをデプロイしてください。

    ## プロジェクト情報
    - プロジェクト名: ${Project}
    - 日付: ${Date}
    - 出力先: ${OutputDir}
    - スペースID: ${SpaceId}（空の場合はポータル直下）

    ## インプット（最初に全て読み込むこと）
    - ${OutputDir}アプリ設計書_${Project}_${Date}.md
    - ${OutputDir}フィールド設計書_${Project}_${Date}.md

    ## 手順
    1. 上記のインプットファイルを全て読み込む
    2. `.claude/skills/kintone-app-creation/SKILL.md` を読んでデプロイ手順を確認
    3. Pre-flight Check を実行
    4. 2-Pass デプロイを優先度順に実行
    5. フォームレイアウトを最適化（横並び配置、グルーピング）
    6. deployment_result.json を生成

    ## 出力ファイル
    - ${OutputDir}deployment_result_${Date}.json
```

## Step 4: Phase 3.5 — カスタマイズ（条件付き）

### 実行判定（メインエージェント直接実行）

1. フィールド設計書からカスタマイズ要件の有無を確認（Readで該当セクションを確認）
2. カスタマイズ要件なし → Step 5へスキップ
3. カスタマイズ要件あり → Task起動

### Task起動

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

    ## 手順
    1. 上記のインプットファイルを全て読み込む
    2. `.claude/skills/kintone-customize/SKILL.md` を読んでカスタマイズ手順を確認
    3. deployment_result.jsonからアプリIDを取得
    4. カスタマイズを生成・適用
    5. deployment_result.json の customizations 配列を更新

    ## 出力
    - カスタマイズJSファイル（outputs/${Project}/）
    - deployment_result_${Date}.json の customizations 更新
```

## Step 5: Phase 4 — テストデータ投入

### Task起動

```
Task(kintone-deployer):
  prompt: |
    以下の手順でkintoneアプリにテストデータを投入してください。

    ## プロジェクト情報
    - プロジェクト名: ${Project}
    - 日付: ${Date}
    - 出力先: ${OutputDir}

    ## インプット（最初に全て読み込むこと）
    - ${OutputDir}フィールド設計書_${Project}_${Date}.md
    - ${OutputDir}deployment_result_${Date}.json（アプリID参照）

    ## 手順
    1. 上記のインプットファイルを全て読み込む
    2. `.claude/skills/kintone-testdata/SKILL.md` を読んでテストデータ投入手順を確認
    3. deployment_result.jsonからアプリIDを取得
    4. 各アプリに3件ずつテストデータを投入
    5. deployment_result.json の testData 配列を更新

    ## 出力
    - deployment_result_${Date}.json の testData 更新
```

## Step 6: 完了レポート表示（メインエージェント直接実行）

**重要**: Step 5（Phase 4）完了後、ユーザー入力を待たずに即座に実行すること。

1. `deployment_result_${Date}.json` をReadで読み込み
2. `reference.md` の完了レポート形式に従って表示
3. 作成したアプリ一覧、URL、テストデータ投入結果、カスタマイズ適用結果を表示

## HITL間の修正対応

ユーザーが修正を要求した場合の対応:

1. 修正内容をヒアリング（メインエージェント）
2. 同じsubagent_typeのサブエージェントを**新規起動**
3. promptに「既存ファイルを読み込んで修正箇所のみ変更」と指示
4. 修正後、HITLに戻る

例（Phase 1の修正）:
```
Task(kintone-analyst):
  prompt: |
    ${OutputDir} の概要書を修正してください。

    ## 修正指示
    ${ユーザーの修正内容}

    ## 対象ファイル
    - ${OutputDir}システム概要書_${Project}_${Date}.md
    - ${OutputDir}機能要件書_${Project}_${Date}.md
    - ${OutputDir}業務フロー_${Project}_${Date}.md

    既存ファイルを読み込み、修正箇所のみ変更してください。
```

## エラーハンドリング

### サブエージェントがエラーで終了した場合

1. エラー内容をユーザーに表示
2. AskUserQuestion: 「再試行しますか？」
   - はい → 同じサブエージェントを再起動
   - いいえ → ワークフロー中断

### Phase 3 デプロイ失敗時

1. deployment_result.json の errors 配列を確認
2. エラー内容をユーザーに表示
3. 修正可能な場合は設計書修正 → 再デプロイ

### kintone接続エラー

1. Pre-flight Check 失敗時はデプロイに進まない
2. `.env` の設定確認を促す

## 出力ファイル

すべて `outputs/${Project}/` に保存：
- `システム概要書_${Project}_${Date}.md`
- `機能要件書_${Project}_${Date}.md`
- `業務フロー_${Project}_${Date}.md`
- `アプリ設計書_${Project}_${Date}.md`
- `フィールド設計書_${Project}_${Date}.md`
- `deployment_result_${Date}.json`

## 注意事項

1. **HITL必須**: 各Phase移行前の確認はスキップ不可
2. **新規作成のみ**: 既存アプリの更新は非対応
3. **ロールバックなし**: デプロイ後の取り消しは手動対応
4. **テストデータ自動投入**: 確認なしで3件投入
