---
name: kintone-workflow
description: kintoneアプリを作成する5フェーズワークフローを開始。段階的にコンテキスト把握→業務フロー→アーキテクチャ→統合レビュー→デプロイまでを支援。
---

# kintone ワークフロー

kintoneアプリを対話形式で作成するワークフロー。メインエージェントはオーケストレーターに徹し、各フェーズをサブエージェント（Task tool）に委譲する。

## 概要

| フェーズ | 内容 | サブエージェント | 出力 |
|---------|------|----------------|------|
| Phase 1 | コンテキスト把握（WHO/WHY） | `kintone-context-analyst` | コンテキスト整理書 |
| Phase 2 | 業務フロー整理（WHAT/WHEN） | `kintone-flow-analyst` | 業務フロー設計書 |
| Phase 3 | アプリアーキテクチャ設計（HOW） | `kintone-architect` | アプリアーキテクチャ書 |
| Phase 4 | 統合レビュー + 詳細設計 | `kintone-designer` + オーケストレーター | アプリ設計書、フィールド設計書、統合レビュー |
| Phase 5 | デプロイ + フィードバック | `kintone-deployer` / `kintone-customizer` | kintoneアプリ + deployment_result.json |

各フェーズ前にチェックポイント（HITL）あり。

## コンテキスト受け渡し

フェーズ間の情報はファイル参照で受け渡す（メインコンテキストに蓄積しない）:

| 受け渡し | ファイル |
|---------|--------|
| Phase 1 → 2 | `outputs/${Project}/コンテキスト整理_${Project}_${Date}.md` |
| Phase 2 → 3 | `outputs/${Project}/業務フロー設計_${Project}_${Date}.md` |
| Phase 3 → 4 | `outputs/${Project}/アプリアーキテクチャ_${Project}_${Date}.md` |
| Phase 4 → 5 | `outputs/${Project}/アプリ設計書_*.md`, `フィールド設計書_*.md` |
| Phase 5 → loop | `outputs/${Project}/フィードバック_${Project}_${Date}_01.md` |

## 実行フロー

```
Step 0: プロジェクト情報確定（メインエージェント）
  ↓
Phase 1: Task(kintone-context-analyst) → コンテキスト把握
  ↓
Checkpoint ①: ゴール・スコープ合意（メインエージェント）
  ↓
Phase 2: Task(kintone-flow-analyst) → 業務フロー整理
  ↓
Checkpoint ②: To-Beフロー合意（メインエージェント）
  ↓
Phase 3: Task(kintone-architect) → アプリアーキテクチャ設計
  ↓
Checkpoint ③: ER図+アプリ構成合意（メインエージェント）
  ↓
Phase 4:
  4-1: Task(kintone-designer) → 詳細設計生成
  4-2: 統合チェック（メインエージェント）
  ↓
Checkpoint ④: 最終合意 + 環境設定（メインエージェント）
  ↓
Phase 5:
  5a: Task(kintone-deployer) → デプロイ
  5b: Task(kintone-customizer) → カスタマイズ（条件付き）
  5c: Task(kintone-deployer) → テストデータ投入
  5d: フィードバック収集 → 必要ならPhase 2/3に戻る
  ↓
完了レポート表示（メインエージェント）
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

## Phase 1: コンテキスト把握（WHO / WHY）

### Task起動

```
Task(kintone-context-analyst):
  prompt: |
    以下の手順でkintoneシステムのコンテキスト把握を行ってください。

    ## プロジェクト情報
    - プロジェクト名: ${Project}
    - 日付: ${Date}
    - 出力先: ${OutputDir}

    ## 手順
    1. `.claude/skills/kintone-context-gathering/SKILL.md` を読んで手順を確認
    2. `.claude/agents/reference/context-interview-flow.md` を読んでヒアリングフローを確認
    3. AskUserQuestionでペインポイント起点の最小限ヒアリング（3問以内）
    4. サマリーしてユーザーに確認
    5. コンテキスト整理書を生成

    ## 出力ファイル
    - ${OutputDir}コンテキスト整理_${Project}_${Date}.md
```

### Checkpoint ①（メインエージェント直接実行）

1. `コンテキスト整理_*.md` をReadで確認
2. ユーザーにサマリを表示:
   - ゴール・優先度テーブル
   - スコープ（対象/対象外）テーブル
   - アクターテーブル
3. AskUserQuestion: 「Phase 2（業務フロー整理）に進んでよろしいですか？」
   - 進む → Phase 2へ
   - 修正する → 修正内容を聞いてPhase 1を再起動

## Phase 2: 業務フロー整理（WHAT / WHEN）

### Task起動

```
Task(kintone-flow-analyst):
  prompt: |
    以下の手順でkintone業務フロー設計を行ってください。

    ## プロジェクト情報
    - プロジェクト名: ${Project}
    - 日付: ${Date}
    - 出力先: ${OutputDir}

    ## インプット（最初に読み込むこと）
    - ${OutputDir}コンテキスト整理_${Project}_${Date}.md

    ## 手順
    1. 上記のインプットファイルを読み込む
    2. `.claude/skills/kintone-flow-design/SKILL.md` を読んで手順を確認
    3. `.claude/agents/reference/flow-analysis-guide.md` を読んで分析ガイドを確認
    4. As-Is業務フローを推測して提案 → ユーザーに修正してもらう
    5. To-Beフロー（kintone導入後）をMermaidで提案
    6. ビジネスイベントを洗い出す
    7. MVPスコープ線引き
    8. 規模感・連携・セキュリティを確認
    9. カスタマイズを推奨度付きで提案
    10. 業務フロー設計書を生成

    ## 出力ファイル
    - ${OutputDir}業務フロー設計_${Project}_${Date}.md
```

### Checkpoint ②（メインエージェント直接実行）

**コンセプト**: 図で合意形成する。テキストではなく図をベースに確認・修正を行う。

1. `業務フロー設計_*.md` をReadで確認
2. **draw.io でTo-Beフロー図を表示**:
   - 業務フロー設計書からTo-Be業務フロー図のMermaidブロックを抽出
   - `open_drawio_mermaid` で draw.io エディタに表示
   - ※ drawio MCPが利用不可の場合はMarkdown上のMermaidテキストで代替
3. ユーザーにサマリを表示:
   - 「draw.io にフロー図を表示しました。ブラウザで確認してください」
   - ビジネスイベント一覧テーブル（「これらがアプリの元になります」と説明）
   - MVPスコープテーブル
   - カスタマイズ要件サマリテーブル
4. AskUserQuestion: 「フロー図を確認してください。修正があれば教えてください。Phase 3 に進んでよろしいですか？」
   - 進む → Phase 3へ
   - 修正 → 以下どちらも受け付ける（混在OK）:
     - 自然言語で伝える → Mermaidを更新
     - draw.ioで直接編集 → `.claude/skills/drawio-diff/SKILL.md` の `generic` モードで差分検出 → 設計書に反映
   - → `open_drawio_mermaid` で図を再表示 → Checkpoint ② に戻る

## Phase 3: アプリアーキテクチャ設計（HOW）

### Task起動

```
Task(kintone-architect):
  prompt: |
    以下の手順でkintoneアプリアーキテクチャを設計してください。

    ## プロジェクト情報
    - プロジェクト名: ${Project}
    - 日付: ${Date}
    - 出力先: ${OutputDir}

    ## インプット（最初に全て読み込むこと）
    - ${OutputDir}コンテキスト整理_${Project}_${Date}.md
    - ${OutputDir}業務フロー設計_${Project}_${Date}.md

    ## 手順
    1. 上記のインプットファイルを全て読み込む
    2. `.claude/skills/kintone-architecture/SKILL.md` を読んで設計手順を確認
    3. ビジネスイベント → アプリ境界を決定
    4. アプリ一覧（マスタ/トランザクション分類）を作成
    5. ER図をMermaid erDiagramで生成
    6. キーフィールド設計（PK、FK、ステータスのみ）
    7. ユースケース × アプリ マッピング
    8. カスタマイズ要件を具体的なアプリ・フィールドにマッピング
    9. アプリアーキテクチャ書を生成

    ## 出力ファイル
    - ${OutputDir}アプリアーキテクチャ_${Project}_${Date}.md
```

### Checkpoint ③（メインエージェント直接実行）

**コンセプト**: ER図で合意形成する。アプリ間の関係を視覚的に確認し、構造を固める。

1. `アプリアーキテクチャ_*.md` をReadで確認
2. **draw.io でER図を表示**:
   - アプリアーキテクチャ書からER図のMermaidブロックを抽出
   - `open_drawio_mermaid` で draw.io エディタに表示
   - ※ drawio MCPが利用不可の場合はMarkdown上のMermaidテキストで代替
3. ユーザーにサマリを表示:
   - 「draw.io にER図を表示しました。ブラウザで確認してください」
   - アプリ一覧テーブル
   - ユースケース × アプリ マッピング
   - カスタマイズ要件マッピングテーブル
4. AskUserQuestion: 「ER図を確認してください。修正があれば教えてください。Phase 4 に進んでよろしいですか？」
   - 進む → Phase 4へ
   - 修正 → 以下どちらも受け付ける（混在OK）:
     - 自然言語で伝える → Mermaidを更新
     - draw.ioで直接編集 → `.claude/skills/drawio-diff/SKILL.md` の `er` モードで差分検出 → アーキテクチャ書を更新
   - → `open_drawio_mermaid` で図を再表示 → Checkpoint ③ に戻る

## Phase 4: 統合レビュー + 詳細設計

### Step 4-1: 詳細設計生成

```
Task(kintone-designer):
  prompt: |
    以下の手順でkintoneアプリ設計書とフィールド設計書を生成してください。

    ## プロジェクト情報
    - プロジェクト名: ${Project}
    - 日付: ${Date}
    - 出力先: ${OutputDir}

    ## インプット（最初に全て読み込むこと）
    - ${OutputDir}コンテキスト整理_${Project}_${Date}.md
    - ${OutputDir}業務フロー設計_${Project}_${Date}.md
    - ${OutputDir}アプリアーキテクチャ_${Project}_${Date}.md

    ## 手順
    1. 上記のインプットファイルを全て読み込む
    2. `.claude/skills/kintone-app-design/SKILL.md` を読んでアプリ設計手順を確認
    3. `.claude/skills/kintone-field-design/SKILL.md` を読んでフィールド設計手順を確認
    4. `.claude/skills/kintone-design-review/SKILL.md` を読んでレビュー手順を確認
    5. アプリアーキテクチャのアプリ一覧・ER図・キーフィールドを基に詳細設計
    6. インプットレビューを実行（CRITICALな不足があれば最終出力に不足リストとして記載）
    7. アプリ設計書を生成
    8. フィールド設計書を生成

    ## 出力ファイル
    - ${OutputDir}アプリ設計書_${Project}_${Date}.md
    - ${OutputDir}フィールド設計書_${Project}_${Date}.md
```

### Step 4-2: 統合チェック（メインエージェント直接実行）

1. Phase 1-4の全文書をReadで確認
2. `.claude/skills/kintone-integration-review/SKILL.md` のチェック項目に従いクロスバリデーション
3. `統合レビュー_${Project}_${Date}.md` を生成

### Checkpoint ④（メインエージェント直接実行）

1. 不足リストが設計書に記載されていないかチェック
   - 不足リストあり → ユーザーに質問して回答を収集 → Step 4-1を再起動
2. 統合レビュー結果を表示:
   - 統合マッピングテーブル（業務タスク × アプリ × 画面操作 × データフロー）
   - ギャップ・矛盾チェック結果
   - デプロイ計画（2-Pass方式）
3. CRITICALが0件であることを確認
   - CRITICALあり → 修正してStep 4-1を再起動
4. 環境・スペース設定:
   - kintone接続確認（Pre-flight Check）
   - スペースID確認（既存スペース or ポータル直下）
   - **重要**: スペースIDは任意の数値が入りうるため、AskUserQuestionの選択肢形式は使わない。「ポータル直下 or 既存スペース」の選択後、既存スペースの場合はテキスト入力でスペースIDを取得する
   - `${SpaceId}` を確定
5. AskUserQuestion: 「Phase 5（デプロイ）に進んでよろしいですか？」
   - 進む → Phase 5へ
   - 修正する → 修正内容を聞いて該当フェーズを再起動

## Phase 5: デプロイ + フィードバック

### Step 5a: デプロイ

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

### Step 5b: カスタマイズ（条件付き）

#### 実行判定（メインエージェント直接実行）

1. フィールド設計書からカスタマイズ要件の有無を確認（Readで該当セクションを確認）
2. カスタマイズ要件なし → Step 5cへスキップ
3. カスタマイズ要件あり → Task起動

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

### Step 5c: テストデータ投入

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

### Step 5d: フィードバック収集

**重要**: Step 5c完了後、まず完了レポートを表示し、その後フィードバックを収集する。

1. `deployment_result_${Date}.json` をReadで読み込み
2. `reference.md` の完了レポート形式に従って表示
3. 作成したアプリ一覧、URL、テストデータ投入結果、カスタマイズ適用結果を表示
4. AskUserQuestion: 「アプリを触ってみて、フィードバックがあれば教えてください。問題なければ『完了』と入力してください」
   - 完了 → ワークフロー終了
   - フィードバックあり → フィードバック処理へ

#### フィードバック処理

1. フィードバック内容をヒアリング
2. `フィードバック_${Project}_${Date}_01.md` を生成（テンプレート: `templates/feedback-template.md`）
3. 影響フェーズを判定:
   - 業務フローの変更が必要 → Phase 2に戻る
   - アプリ構成・ER図の変更が必要 → Phase 3に戻る
   - フィールド設計の変更のみ → Phase 4に戻る
   - デプロイ設定やカスタマイズの修正のみ → Phase 5の該当サブフェーズのみ再実行
4. 該当フェーズを再起動

## HITL間の修正対応

ユーザーが修正を要求した場合の対応:

1. 修正内容をヒアリング（メインエージェント）
2. 同じsubagent_typeのサブエージェントを**新規起動**
3. promptに「既存ファイルを読み込んで修正箇所のみ変更」と指示
4. 修正後、Checkpointに戻る

例（Phase 1の修正）:
```
Task(kintone-context-analyst):
  prompt: |
    ${OutputDir} のコンテキスト整理書を修正してください。

    ## 修正指示
    ${ユーザーの修正内容}

    ## 対象ファイル
    - ${OutputDir}コンテキスト整理_${Project}_${Date}.md

    既存ファイルを読み込み、修正箇所のみ変更してください。
```

## エラーハンドリング

### サブエージェントがエラーで終了した場合

1. エラー内容をユーザーに表示
2. AskUserQuestion: 「再試行しますか？」
   - はい → 同じサブエージェントを再起動
   - いいえ → ワークフロー中断

### Phase 5 デプロイ失敗時

1. deployment_result.json の errors 配列を確認
2. エラー内容をユーザーに表示
3. 修正可能な場合は設計書修正 → 再デプロイ

### kintone接続エラー

1. Pre-flight Check 失敗時はデプロイに進まない
2. `.env` の設定確認を促す

## 出力ファイル

すべて `outputs/${Project}/` に保存：
- `コンテキスト整理_${Project}_${Date}.md`
- `業務フロー設計_${Project}_${Date}.md`
- `アプリアーキテクチャ_${Project}_${Date}.md`
- `アプリ設計書_${Project}_${Date}.md`
- `フィールド設計書_${Project}_${Date}.md`
- `統合レビュー_${Project}_${Date}.md`
- `deployment_result_${Date}.json`
- `フィードバック_${Project}_${Date}_*.md`（フィードバック時のみ）

## 注意事項

1. **HITL必須**: 各Checkpoint（①②③④）の確認はスキップ不可
2. **新規作成のみ**: 既存アプリの更新は非対応
3. **ロールバックなし**: デプロイ後の取り消しは手動対応
4. **テストデータ自動投入**: 確認なしで3件投入
5. **フィードバックループ**: Phase 5d でフィードバックがある場合は適切なフェーズに戻る
