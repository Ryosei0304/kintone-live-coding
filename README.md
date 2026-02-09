# kintone-live-coding

対話形式でkintoneアプリを作成するワークフロー。Claude Codeスキルとして動作します。

## クイックスタート

```
/start
```

このコマンドでkintoneアプリ作成ワークフローを開始できます。

## 前提条件

### 環境変数の設定

`.env` ファイルをプロジェクトルートに作成：

```env
KINTONE_DOMAIN=https://xxx.cybozu.com
KINTONE_USERNAME=your-username
KINTONE_PASSWORD=your-password
```

**重要**: `.env` は `.gitignore` に追加済みなので、絶対にコミットしないこと。

## 概要

業務担当者（非エンジニア）がkintoneアプリを作成する際、対話形式で情報を収集し、概要書→設計書→アプリデプロイ→カスタマイズ→テストデータ投入までを一貫して支援します。

## ワークフロー（5フェーズ構成）

```mermaid
flowchart LR
    Input["業務要件\nヒアリング"]
    P1["Phase 1\n概要書生成"]
    P2["Phase 2\n設計書生成"]
    P3["Phase 3\nデプロイ"]
    P35["Phase 3.5\nカスタマイズ"]
    P4["Phase 4\nテストデータ"]
    Done["完成"]

    Input --> P1
    P1 -- "✅ HITL確認" --> P2
    P2 -- "✅ HITL確認" --> P3
    P3 -- "✅ HITL確認" --> P35
    P35 -- "✅ HITL確認" --> P4
    P4 --> Done

    style Input fill:#e8f5e9,stroke:#4caf50
    style P1 fill:#e3f2fd,stroke:#2196f3
    style P2 fill:#e3f2fd,stroke:#2196f3
    style P3 fill:#fff3e0,stroke:#ff9800
    style P35 fill:#fff3e0,stroke:#ff9800
    style P4 fill:#fce4ec,stroke:#e91e63
    style Done fill:#f3e5f5,stroke:#9c27b0
```

### Phase 1: インプット → 概要書
- 対話形式で業務要件を収集
- システム概要書・機能要件書・業務フローを生成
- **自動レビュー**: 概要書・要件定義のkintone適合性・業務フロー妥当性を検証

### Phase 2: 概要書 → 設計書（2ステップ）
- 概要書からアプリ設計書を生成
- アプリ設計書からフィールド設計書を生成
- **自動レビュー**: アプリ設計書・フィールド設計書のkintone制限値・設計パターンを検証

### Phase 3: 設計書 → kintoneアプリ
- REST API経由でkintoneにアプリを作成（2-Pass 優先度順デプロイ）
- Pass 1: 基本フィールドを追加してデプロイ
- Pass 2: ルックアップ/関連レコード一覧を追加してデプロイ
- **自動レビュー**: デプロイ前のAPI制限値・デプロイ順序・エラーハンドリングを検証

### Phase 3.5: カスタマイズ適用（オプション）
- パターンベースでJavaScript/CSSを自動生成
- REST API経由でkintoneに適用
- 新規アプリのみ対応（既存カスタマイズがあるアプリはスキップ）

### Phase 4: テストデータ投入
- デプロイ済みアプリにサンプルデータ3件を自動投入
- フィールド設計に基づいたリアルなテストデータを生成

## HITL（Human-in-the-Loop）

各Phase移行前に必ず確認プロセスを通します。スキップ不可です。

## 利用可能なスキル

### メインスキル

| スキル | コマンド | 説明 |
|--------|----------|------|
| kintone-workflow | `/kintone-workflow` | メインワークフロー（Phase 1〜4を実行） |
| kintone-mcp-setup | `/kintone-mcp-setup` | kintone接続のセットアップ支援 |
| kintone-testdata | `/kintone-testdata` | デプロイ済みkintoneアプリにテストデータを自動投入（3件） |
| kintone-error-handbook | `/kintone-error-handbook` | kintone REST APIエラーコード別対処法ハンドブック |
| kintone-relationship-visualizer | `/kintone-relationship-visualizer` | アプリ間の関係をMermaid ER図で可視化 |

### フェーズ別スキル

| スキル | コマンド | 説明 |
|--------|----------|------|
| kintone-proposal | `/kintone-proposal` | Phase 1: 概要書生成 |
| kintone-app-design | `/kintone-app-design` | Phase 2-1: アプリ設計書生成 |
| kintone-field-design | `/kintone-field-design` | Phase 2-2: フィールド設計書生成 |
| kintone-app-creation | `/kintone-app-creation` | Phase 3: 2-Pass 優先度順デプロイ |
| kintone-customize | `/kintone-customize` | Phase 3.5: カスタマイズ適用 |

### エキスパートレビュースキル（HITL前自動実行）

| スキル | 説明 |
|--------|------|
| kintone-proposal-review | Phase 1レビュー: 概要書・要件定義のkintone適合性・業務フロー妥当性を検証 |
| kintone-design-review | Phase 2レビュー: アプリ設計書・フィールド設計書のkintone制限値・設計パターンを検証 |
| kintone-creation-review | Phase 3レビュー: デプロイ前のAPI制限値・デプロイ優先度順序・エラーハンドリングを検証 |

## 利用可能なサブエージェント

| エージェント | 用途 |
|--------------|------|
| kintone-setup | kintone接続のセットアップ確認・支援 |
| kintone-analyst | 業務要件のヒアリング・概要書生成 |
| kintone-designer | kintoneアプリ・フィールド設計 |
| kintone-deployer | kintoneへのデプロイ実行（REST API） |
| kintone-customizer | カスタマイズコードの生成・REST APIで適用 |

## カスタマイズパターン

Phase 3.5では、パターンベースでkintoneカスタマイズコードを自動生成します。全18パターン、9カテゴリに対応。

### 対応パターン一覧

#### フィールド制御

| パターンID | 名前 | 用途 |
|-----------|------|------|
| `field_show_hide` | フィールド表示/非表示 | 条件に応じてフィールドを表示/非表示 |
| `field_disable` | フィールド編集不可 | 条件に応じてフィールドを編集不可 |
| `field_char_count` | 文字数カウント表示 | 入力文字数をリアルタイムで表示 |
| `dropdown_cascade` | ドロップダウン連動 | ドロップダウンの値で別フィールドを変更/無効化 |
| `group_toggle` | グループフィールド開閉制御 | 条件に応じてグループフィールドの開閉を自動制御 |

#### 条件分岐

| パターンID | 名前 | 用途 |
|-----------|------|------|
| `condition_status` | ステータス分岐 | ステータス値に応じた複合処理 |

#### バリデーション

| パターンID | 名前 | 用途 |
|-----------|------|------|
| `validate_required` | 条件付き必須 | 条件に応じて必須チェック |
| `validate_format` | 入力フォーマットチェック | 郵便番号/電話番号/メールアドレスの形式チェック |

#### 見た目装飾

| パターンID | 名前 | 用途 |
|-----------|------|------|
| `style_section_header` | セクション見出し | スペーサーに見出しを追加してフォームをグルーピング |

#### 自動処理

| パターンID | 名前 | 用途 |
|-----------|------|------|
| `auto_numbering` | 自動採番 | 独自フォーマットで自動採番 |
| `lookup_auto_update` | ルックアップ自動更新 | ルックアップ元データ更新時に最新情報を自動取得 |

#### 一覧画面

| パターンID | 名前 | 用途 |
|-----------|------|------|
| `list_button` | 一覧画面ボタン追加 | レコード一覧にカスタムボタンを追加 |
| `list_conditional_style` | 一覧画面条件書式 | 条件に応じて行の背景色を設定 |
| `list_progress_bar` | プログレスバー表示 | ステータスをプログレスバーで視覚化 |

#### テーブル

| パターンID | 名前 | 用途 |
|-----------|------|------|
| `table_total` | テーブル合計計算 | テーブル内の数値フィールドを合計・集計 |
| `table_add_row` | テーブル行追加ボタン | ボタンクリックでテーブルに行を追加 |

#### プロセス管理

| パターンID | 名前 | 用途 |
|-----------|------|------|
| `auto_status_update` | 自動ステータス更新 | 条件に応じてステータスを自動更新 |

#### 日付・時刻

| パターンID | 名前 | 用途 |
|-----------|------|------|
| `elapsed_years` | 経過年数/日数表示 | 基準日からの経過年数・月数・日数をリアルタイム表示 |

### カスタマイズ要件の例

```
「ステータスが完了の時、備考フィールドを編集不可にしたい」
→ field_disable パターンを使用

「セクション見出しで基本情報と詳細情報を分けたい」
→ style_section_header パターンを使用

「請求書番号を INV-202602-0001 形式で自動採番したい」
→ auto_numbering パターンを使用

「一覧画面でステータスごとに行の色を変えたい」
→ list_conditional_style パターンを使用
```

### 制限事項

- **新規アプリのみ対応**: 既存のカスタマイズがあるアプリはスキップ
- **パターン拡張**: 開発者のみパターン追加可能（ユーザーは追加不可）

## ディレクトリ構造

```
kintone-live-coding/
├── .claude/
│   ├── commands/                    # カスタムコマンド
│   │   └── start.md                # /start でワークフロー開始
│   ├── agents/                      # サブエージェント定義
│   │   ├── kintone-setup.md        # 接続セットアップ支援
│   │   ├── kintone-analyst.md      # 業務要件ヒアリング・概要書生成
│   │   ├── kintone-designer.md     # アプリ・フィールド設計
│   │   ├── kintone-deployer.md     # kintoneデプロイ実行（REST API）
│   │   ├── kintone-customizer.md   # カスタマイズコード生成・適用
│   │   └── reference/              # エージェント参照資料
│   │       └── interview-flow.md   # ヒアリングフロー定義
│   ├── rules/                       # プロジェクトルール
│   │   ├── kintone-api.md          # REST API操作ルール
│   │   ├── priority-deployment.md  # 2-Pass デプロイルール（優先度順）
│   │   └── customize-patterns.md   # カスタマイズパターン
│   ├── settings.local.json          # ローカル設定
│   └── skills/
│       ├── kintone-workflow/       # メインワークフロー
│       │   ├── SKILL.md
│       │   └── reference.md        # 詳細手順リファレンス
│       ├── kintone-mcp-setup/      # 接続セットアップスキル
│       ├── kintone-proposal/       # Phase 1: 概要書生成
│       ├── kintone-proposal-review/  # Phase 1: 概要書レビュー
│       ├── kintone-app-design/     # Phase 2-1: アプリ設計
│       ├── kintone-field-design/   # Phase 2-2: フィールド設計
│       ├── kintone-design-review/  # Phase 2: 設計書レビュー
│       ├── kintone-app-creation/   # Phase 3: 2-Pass 優先度順デプロイ
│       │   ├── SKILL.md
│       │   └── scripts/            # デプロイ用Pythonスクリプト
│       │       ├── run.py
│       │       ├── kintone_client.py
│       │       ├── field_builder.py
│       │       ├── dependency_graph.py
│       │       └── requirements.txt
│       ├── kintone-creation-review/  # Phase 3: デプロイ前レビュー
│       ├── kintone-customize/      # Phase 3.5: カスタマイズ適用
│       ├── kintone-testdata/       # Phase 4: テストデータ投入
│       ├── kintone-error-handbook/ # エラーコード別対処法ハンドブック
│       └── kintone-relationship-visualizer/  # ER図生成
├── templates/                       # ドキュメントテンプレート
│   ├── proposal-template.md        # 概要書テンプレート
│   ├── app-design-template.md      # アプリ設計書テンプレート
│   ├── field-design-template.md    # フィールド設計書テンプレート
│   └── customize/                   # カスタマイズテンプレート（16パターン）
│       ├── catalog.json            # パターンカタログ（v2.0.0、18パターン）
│       ├── patterns/               # JSパターンテンプレート
│       └── styles/                 # CSSテンプレート
├── outputs/                         # 生成ドキュメント出力先
├── CLAUDE.md                        # Claude Code設定
└── README.md
```

## 出力ファイル

### 出力先ディレクトリ

```
outputs/${ProjectName}/
```

### ファイル命名規則

| ドキュメント種別 | ファイル名例 |
|------------------|-------------|
| システム概要書 | `システム概要書_顧客管理_20260205.md` |
| 機能要件書 | `機能要件書_顧客管理_20260205.md` |
| 業務フロー | `業務フロー_顧客管理_20260205.md` |
| アプリ設計書 | `アプリ設計書_顧客管理_20260205.md` |
| フィールド設計書 | `フィールド設計書_顧客管理_20260205.md` |

## 入力形式

- テキスト入力（最大10,000文字）
- ファイルアップロード（.txt, .md, .csv, .pdf, .docx, .xlsx）

## 対応機能

- アプリ新規作成（既存アプリの更新は非対応）
- ルックアップ/関連レコード一覧
- プロセス管理（基本設定のみ）
- アクセス権（基本権限設定）
- カスタマイズコード自動生成・適用（Phase 3.5）
- テストデータ自動投入（Phase 4）

## 制約事項

- **REST APIのみ使用**: Bash + curlで直接呼び出し
- **2-Pass 優先度順デプロイ**: Pass 1で基本フィールド、Pass 2でルックアップ/関連レコード
- **新規作成のみ対応**: 既存アプリの更新は非対応
- **HITL必須**: 各Phase移行前の確認はスキップ不可

## 重要な注意事項

- ルックアップ/関連レコード一覧の参照先アプリは**デプロイ済み**でないと参照できない
- デプロイ順序: マスタアプリ → デプロイ → トランザクションアプリ → デプロイ
- `.env`ファイルは絶対にコミットしないこと
