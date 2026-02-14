# kintone-live-coding

対話形式でkintoneアプリを作成・修正するワークフロー。Claude Codeスキルとして動作します。

## クイックスタート

```
/start     # 新規アプリ作成
/restart   # 既存アプリ修正
```

## 前提条件

### 環境変数の設定

`.env` ファイルをプロジェクトルートに作成：

```env
KINTONE_DOMAIN=https://xxx.cybozu.com
KINTONE_USERNAME=your-username
KINTONE_PASSWORD=your-password
```

**重要**: `.env` は `.gitignore` に追加済みなので、絶対にコミットしないこと。

### MCPサーバー

以下のMCPサーバーが必要です：

| サーバー | 用途 |
|----------|------|
| **playwright** | draw.ioのブラウザ操作（ER図表示・差分検出） |
| **drawio** | Mermaid→draw.io変換（`open_drawio_mermaid`） |
| **context7** | ライブラリドキュメント参照 |
| **pencil** | .penファイルのデザイン編集 |

> **Note**: kintone操作はREST API（curl）で直接実行します。kintone MCPツールは使用しません。

## 概要

業務担当者（非エンジニア）がkintoneアプリを作成・修正する際、対話形式で情報を収集し、コンテキスト整理→業務フロー設計→アプリアーキテクチャ→統合レビュー→デプロイまでを一貫して支援します。

## ワークフロー

### `/start`（新規作成）：5フェーズ構成

```mermaid
flowchart LR
    P1["Phase 1\nコンテキスト把握"]
    P2["Phase 2\n業務フロー整理"]
    P3["Phase 3\nアプリアーキテクチャ"]
    P4["Phase 4\n統合レビュー\n+ 詳細設計"]
    P5["Phase 5\nデプロイ\n+ フィードバック"]

    P1 -- "HITL確認" --> P2
    P2 -- "HITL確認" --> P3
    P3 -- "HITL確認" --> P4
    P4 -- "HITL確認" --> P5

    style P1 fill:#e8f5e9,stroke:#4caf50
    style P2 fill:#e3f2fd,stroke:#2196f3
    style P3 fill:#e3f2fd,stroke:#2196f3
    style P4 fill:#fff3e0,stroke:#ff9800
    style P5 fill:#fce4ec,stroke:#e91e63
```

| Phase | 内容 | 出力 |
|-------|------|------|
| **Phase 1** コンテキスト把握 | ペインポイント起点でWHO/WHYを整理 | コンテキスト整理書 |
| **Phase 2** 業務フロー整理 | As-Is/To-Beフロー設計、ビジネスイベント洗い出し、カスタマイズ提案 | 業務フロー設計書 |
| **Phase 3** アプリアーキテクチャ | ビジネスイベントからアプリ境界を決定、ER図生成 | アプリアーキテクチャ設計書 |
| **Phase 4** 統合レビュー + 詳細設計 | Phase 1-3のクロスバリデーション、アプリ・フィールド設計書生成 | 統合レビュー、アプリ設計書、フィールド設計書 |
| **Phase 5** デプロイ + フィードバック | 2-Passデプロイ、カスタマイズ適用、テストデータ投入 | デプロイ済みアプリ |

### `/restart`（既存修正）：5ステップ構成

```mermaid
flowchart LR
    S0["Step 0\nアプリ選択"]
    R1["Phase R1\nリバースエンジニアリング"]
    R2["Phase R2\n変更計画"]
    R3["Phase R3\n詳細設計更新"]
    R4["Phase R4\n変更適用"]

    S0 --> R1
    R1 -- "HITL確認" --> R2
    R2 -- "HITL確認" --> R3
    R3 -- "HITL確認" --> R4

    style S0 fill:#e8f5e9,stroke:#4caf50
    style R1 fill:#e3f2fd,stroke:#2196f3
    style R2 fill:#fff3e0,stroke:#ff9800
    style R3 fill:#fff3e0,stroke:#ff9800
    style R4 fill:#fce4ec,stroke:#e91e63
```

| Phase | 内容 | 出力 |
|-------|------|------|
| **Step 0** アプリ選択 | スペースID指定 → アプリ一覧表示 → 対象アプリ選択 | - |
| **Phase R1** リバースエンジニアリング | 既存アプリのREST API読み込み → 現状分析 | 現状分析書 |
| **Phase R2** 変更計画 | ユーザーの変更要望 → 構造化された変更計画 | 変更計画書 |
| **Phase R3** 詳細設計更新 | 現状分析 + 変更計画 → 設計書の生成・更新 | アプリ設計書、フィールド設計書 |
| **Phase R4** 変更適用 | 5-Passアップデートデプロイでkintoneに変更を適用 | 更新済みアプリ |

## HITL（Human-in-the-Loop）

各Phase移行前に必ず確認プロセスを通します。スキップ不可です。

## デプロイ方式

### 新規作成（2-Passデプロイ）

| Pass | 内容 |
|------|------|
| **Pass 1** | 全アプリ作成 + 基本フィールド追加 → デプロイ |
| **Pass 2** | ルックアップ/関連レコード追加 + レイアウト最適化 → 再デプロイ |

### 既存修正（5-Passアップデートデプロイ）

| Pass | 内容 |
|------|------|
| **Pass U1** | 基本フィールド変更（DELETE → MODIFY → ADD） |
| **Pass U2** | 新規アプリ + 関係変更（依存順） |
| **Pass U3** | プロセス管理更新 |
| **Pass U4** | レイアウト最適化 |
| **Pass U5** | ビュー更新 |

## エージェント↔スキル対応表

エージェントはツール制限と実行環境を定義し、スキルはドメイン知識を提供します。

| Phase | エージェント | スキル |
|-------|-------------|--------|
| 1 | `kintone-context-analyst` | `kintone-context-gathering` |
| 2 | `kintone-flow-analyst` | `kintone-flow-design` |
| 3 | `kintone-architect` | `kintone-architecture` |
| 4 | - | `kintone-integration-review`, `kintone-app-design`, `kintone-field-design` |
| 5 | `kintone-deployer` | `kintone-app-creation` |
| 5b | `kintone-customizer` | `kintone-customize` |
| R1 | `kintone-reverse-engineer` | `kintone-reverse-engineering` |
| R2 | `kintone-change-planner` | `kintone-change-planning` |
| R3 | `kintone-design-updater` | - |
| R4 | `kintone-updater` | `kintone-app-update` |
| Util | `kintone-setup` | `kintone-mcp-setup`, `kintone-error-handbook`, `kintone-relationship-visualizer`, `kintone-testdata` |

## 利用可能なスキル

### メインスキル

| スキル | コマンド | 説明 |
|--------|----------|------|
| kintone-workflow | `/kintone-workflow` | 新規作成ワークフロー（Phase 1〜5） |
| kintone-restart-workflow | `/kintone-restart-workflow` | 既存修正ワークフロー（Phase R1〜R4） |

### フェーズ別スキル（`/start`）

| スキル | Phase | 自動実行防止 |
|--------|-------|:---:|
| kintone-context-gathering | Phase 1: コンテキスト把握 | - |
| kintone-flow-design | Phase 2: 業務フロー設計 | - |
| kintone-architecture | Phase 3: アプリアーキテクチャ | - |
| kintone-integration-review | Phase 4: 統合レビュー | - |
| kintone-app-design | Phase 4: アプリ設計書生成 | - |
| kintone-field-design | Phase 4: フィールド設計書生成 | - |
| kintone-app-creation | Phase 5: 2-Passデプロイ | yes |
| kintone-customize | Phase 5: カスタマイズ適用 | yes |

### フェーズ別スキル（`/restart`）

| スキル | Phase | 自動実行防止 |
|--------|-------|:---:|
| kintone-reverse-engineering | Phase R1: リバースエンジニアリング | - |
| kintone-change-planning | Phase R2: 変更計画作成 | - |
| kintone-app-update | Phase R4: 5-Passアップデートデプロイ | yes |

### ユーティリティスキル

| スキル | 説明 | 自動実行防止 |
|--------|------|:---:|
| kintone-mcp-setup | kintone接続のセットアップ支援 | - |
| kintone-testdata | デプロイ済みアプリにテストデータを自動投入（3件） | yes |
| kintone-error-handbook | REST APIエラーコード別対処法ハンドブック | - |
| kintone-relationship-visualizer | アプリ間の関係をMermaid ER図で可視化 | - |
| drawio-diff | draw.io ER図と設計書の差分検出・自動更新 | - |

> **自動実行防止（`disable-model-invocation: true`）**: kintoneへの書き込みを伴うスキルは、Claudeが自動で実行しないよう制限されています。ワークフロースキルから明示的に呼び出されます。

### レビュースキル（HITL前自動実行）

| スキル | 説明 |
|--------|------|
| kintone-design-review | 設計書のkintone制限値・設計パターンを検証 |
| kintone-creation-review | デプロイ前のAPI制限値・デプロイ順序を検証 |

## カスタマイズパターン（18パターン / 9カテゴリ）

パターンベースでkintoneカスタマイズコード（JavaScript/CSS）を自動生成します。

| カテゴリ | パターン |
|----------|----------|
| フィールド制御 | `field_show_hide`, `field_disable`, `field_char_count`, `dropdown_cascade`, `group_toggle` |
| 条件分岐 | `condition_status` |
| バリデーション | `validate_required`, `validate_format` |
| 見た目装飾 | `style_section_header` |
| 自動処理 | `auto_numbering`, `lookup_auto_update` |
| 一覧画面 | `list_button`, `list_conditional_style`, `list_progress_bar` |
| テーブル | `table_total`, `table_add_row` |
| プロセス管理 | `auto_status_update` |
| 日付・時刻 | `elapsed_years` |

## ディレクトリ構造

```
kintone-live-coding/
├── .claude/
│   ├── commands/                        # スラッシュコマンド
│   │   ├── start.md                    # /start → 新規作成ワークフロー
│   │   └── restart.md                  # /restart → 既存修正ワークフロー
│   ├── agents/                          # サブエージェント定義
│   │   ├── kintone-setup.md            # REST API接続セットアップ支援
│   │   ├── kintone-context-analyst.md  # コンテキスト把握・ヒアリング
│   │   ├── kintone-flow-analyst.md     # 業務フロー分析
│   │   ├── kintone-architect.md        # アプリアーキテクチャ設計
│   │   ├── kintone-design-updater.md   # 設計書更新（/restart用）
│   │   ├── kintone-deployer.md         # 新規デプロイ実行
│   │   ├── kintone-updater.md          # 既存アプリ更新（/restart用）
│   │   ├── kintone-customizer.md       # カスタマイズ生成・適用
│   │   ├── kintone-reverse-engineer.md # リバースエンジニアリング
│   │   ├── kintone-change-planner.md   # 変更計画作成
│   │   └── deprecated/                 # 非推奨エージェント
│   │       ├── kintone-designer.md     # → kintone-architect に統合
│   │       └── v1/                     # v1レガシー
│   ├── rules/                           # プロジェクトルール
│   │   ├── kintone-api.md              # REST API操作・認証ルール
│   │   ├── priority-deployment.md      # 2-Pass / 5-Passデプロイルール
│   │   └── customize-patterns.md       # カスタマイズパターン定義
│   └── skills/                          # スキル定義
│       ├── kintone-workflow/           # メインワークフロー（/start）
│       ├── kintone-restart-workflow/   # 既存修正ワークフロー（/restart）
│       ├── kintone-context-gathering/  # Phase 1（+ ヒアリングフロー参照資料）
│       ├── kintone-flow-design/        # Phase 2（+ フロー分析ガイド参照資料）
│       ├── kintone-architecture/       # Phase 3: アーキテクチャ
│       ├── kintone-integration-review/ # Phase 4: 統合レビュー
│       ├── kintone-app-design/         # Phase 4: アプリ設計書
│       ├── kintone-field-design/       # Phase 4: フィールド設計書
│       ├── kintone-app-creation/       # Phase 5: 2-Passデプロイ
│       │   └── scripts/               # デプロイ用Pythonスクリプト
│       ├── kintone-customize/          # Phase 5: カスタマイズ適用
│       ├── kintone-reverse-engineering/# Phase R1: リバースエンジニアリング
│       ├── kintone-change-planning/    # Phase R2: 変更計画
│       ├── kintone-app-update/         # Phase R4: 5-Passアップデートデプロイ
│       ├── kintone-design-review/      # 設計書レビュー
│       ├── kintone-creation-review/    # デプロイ前レビュー
│       ├── kintone-mcp-setup/          # 接続セットアップ
│       ├── kintone-testdata/           # テストデータ投入
│       ├── kintone-error-handbook/     # エラー対処法
│       ├── kintone-relationship-visualizer/ # ER図可視化
│       ├── drawio-diff/               # draw.io差分検出
│       └── deprecated/                # 非推奨スキル
│           ├── kintone-proposal/      # → kintone-context-gathering に統合
│           └── kintone-proposal-review/ # → kintone-design-review に統合
├── templates/                           # ドキュメントテンプレート
│   ├── context-template.md            # コンテキスト整理書
│   ├── flow-design-template.md        # 業務フロー設計書
│   ├── architecture-template.md       # アプリアーキテクチャ
│   ├── integration-review-template.md # 統合レビュー
│   ├── app-design-template.md         # アプリ設計書
│   ├── field-design-template.md       # フィールド設計書
│   ├── current-state-template.md      # 現状分析書（/restart用）
│   ├── change-plan-template.md        # 変更計画書（/restart用）
│   ├── feedback-template.md           # フィードバック
│   └── customize/                      # カスタマイズテンプレート
│       ├── catalog.json               # パターンカタログ（v2.0.0、18パターン）
│       ├── patterns/                  # JSパターンテンプレート（18ファイル）
│       └── styles/                    # CSSテンプレート
├── scripts/                            # ユーティリティスクリプト
│   └── drawio-pull.js                 # draw.io XML取得
├── outputs/                            # 生成ドキュメント出力先（gitignore対象）
├── CLAUDE.md                           # Claude Code設定
└── README.md
```

## 出力ファイル

### 出力先ディレクトリ

```
outputs/${ProjectName}/
```

### ファイル命名規則

#### `/start`（新規作成）

| ドキュメント種別 | ファイル名例 |
|------------------|-------------|
| コンテキスト整理書 | `コンテキスト整理_顧客管理_20260215.md` |
| 業務フロー設計書 | `業務フロー設計_顧客管理_20260215.md` |
| アプリアーキテクチャ | `アプリアーキテクチャ_顧客管理_20260215.md` |
| 統合レビュー | `統合レビュー_顧客管理_20260215.md` |
| アプリ設計書 | `アプリ設計書_顧客管理_20260215.md` |
| フィールド設計書 | `フィールド設計書_顧客管理_20260215.md` |

#### `/restart`（既存修正）

| ドキュメント種別 | ファイル名例 |
|------------------|-------------|
| 現状分析書 | `現状分析_受注管理_20260215.md` |
| 変更計画書 | `変更計画_受注管理_20260215.md` |
| アプリ設計書 | `アプリ設計書_受注管理_20260215.md` |
| フィールド設計書 | `フィールド設計書_受注管理_20260215.md` |

## 対応機能

- アプリ新規作成（`/start`）
- 既存アプリの修正（`/restart`）
- ルックアップ/関連レコード一覧
- プロセス管理
- カスタマイズコード自動生成・適用（18パターン）
- テストデータ自動投入
- draw.io ER図との差分検出・設計書自動更新

## 制約事項

- **kintone操作はREST API（curl）で実行**: kintone MCPツールは使用しない
- **2-Passデプロイ**（新規）: Pass 1で基本フィールド、Pass 2でルックアップ/関連レコード
- **5-Passアップデートデプロイ**（既存修正）: フィールド→関係→プロセス管理→レイアウト→ビュー
- **HITL必須**: 各Phase移行前の確認はスキップ不可
- `.env`ファイルは絶対にコミットしないこと
