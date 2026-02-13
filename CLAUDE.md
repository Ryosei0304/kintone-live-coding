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
- `.claude/rules/priority-deployment.md` - 2-Pass デプロイ（優先度順）
- `.claude/rules/customize-patterns.md` - カスタマイズパターン

## 制約事項

- **YOU MUST use REST API only**: MCPツールは使用しない、curlで直接呼び出し
- **YOU MUST use 2-Pass deployment（優先度順）**: Pass 1で基本フィールド、Pass 2でルックアップ/関連レコード
- **新規作成（`/start`）および既存アプリ修正（`/restart`）に対応**
- **HITL必須**: 各Phase移行前の確認はスキップ不可
