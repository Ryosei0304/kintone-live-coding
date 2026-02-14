# kintone Live Coding

kintoneアプリを対話形式で作成するワークフロー。

## クイックスタート

```
/start     # 新規アプリ作成
/restart   # 既存アプリ修正
```

## ワークフロー

### /start（新規作成）
Phase 1（コンテキスト把握）→ Phase 2（業務フロー整理）→ Phase 3（アプリアーキテクチャ）→ Phase 4（統合レビュー + 詳細設計）→ Phase 5（デプロイ + フィードバック）

### /restart（既存修正）
Step 0（アプリ選択）→ Phase R1（リバースエンジニアリング）→ Phase R2（変更計画）→ Phase R3（詳細設計更新）→ Phase R4（変更適用 + フィードバック）

## ルール

- `.claude/rules/kintone-api.md` - kintone REST API操作・認証・環境変数
- `.claude/rules/priority-deployment.md` - 5-Pass デプロイ（優先度順）
- `.claude/rules/customize-patterns.md` - カスタマイズパターン

## MCPサーバー

| サーバー | 用途 |
|----------|------|
| **playwright** | draw.ioのブラウザ操作（ER図表示・差分検出） |
| **drawio** | Mermaid→draw.io変換（`open_drawio_mermaid`） |
| **context7** | ライブラリドキュメント参照 |
| **pencil** | .penファイルのデザイン編集 |

## エージェント↔スキル対応表

| Phase | エージェント（ツール制限・実行） | スキル（ドメイン知識） |
|-------|-------------------------------|---------------------|
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

## 制約事項

- **kintone操作はREST API（curl）で実行**: kintone MCPツールは使用しない
- **YOU MUST use 2-Pass deployment（優先度順）**: Pass 1で基本フィールド、Pass 2でルックアップ/関連レコード
- **新規作成（`/start`）および既存アプリ修正（`/restart`）に対応**
- **HITL必須**: 各Phase移行前の確認はスキップ不可
