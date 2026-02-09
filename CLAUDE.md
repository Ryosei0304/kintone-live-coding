# kintone Live Coding

kintoneアプリを対話形式で作成するワークフロー。

## クイックスタート

```
/start
```

## ワークフロー

Phase 1（概要書）→ Phase 2（設計書）→ Phase 3（デプロイ）→ Phase 3.5（カスタマイズ）→ Phase 4（テストデータ）

## ルール

- `.claude/rules/kintone-api.md` - kintone REST API操作・認証・環境変数
- `.claude/rules/priority-deployment.md` - 2-Pass デプロイ（優先度順）
- `.claude/rules/customize-patterns.md` - カスタマイズパターン

## 制約事項

- **YOU MUST use REST API only**: MCPツールは使用しない、curlで直接呼び出し
- **YOU MUST use 2-Pass deployment（優先度順）**: Pass 1で基本フィールド、Pass 2でルックアップ/関連レコード
- **新規作成のみ対応**: 既存アプリの更新は非対応
- **HITL必須**: 各Phase移行前の確認はスキップ不可
