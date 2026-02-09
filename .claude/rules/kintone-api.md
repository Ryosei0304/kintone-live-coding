# kintone REST API ルール

このプロジェクトはkintone REST APIをBash + curlで直接呼び出してkintoneを操作する。

## 環境変数

`.env`（gitignore対象）:
```env
KINTONE_DOMAIN=https://xxx.cybozu.com
KINTONE_USERNAME=your-username
KINTONE_PASSWORD=your-password
```

## 認証

```bash
# .env を読み込み
set -a && source .env && set +a

# 認証ヘッダー生成
AUTH=$(echo -n "${KINTONE_USERNAME}:${KINTONE_PASSWORD}" | base64)

# API呼び出し
curl -s -X GET "${KINTONE_DOMAIN}/k/v1/apps.json" \
  -H "X-Cybozu-Authorization: ${AUTH}"
```

## 重要な制約

- **すべてのkintone操作はREST API（curl）で実行**（MCPツールは使用しない）
- ルックアップ/関連レコード一覧の参照先アプリは**デプロイ済み**でないと参照できない
- `.env` は `.gitignore` に追加して**絶対にコミットしない**

## Pre-flight Check（必須）

API呼び出し前に必ず接続確認を実行する。

```bash
# 1. 環境変数の確認
set -a && source .env && set +a

if [ -z "$KINTONE_DOMAIN" ] || [ -z "$KINTONE_USERNAME" ] || [ -z "$KINTONE_PASSWORD" ]; then
  echo "環境変数が設定されていません。.envファイルを確認してください。"
  exit 1
fi

# 2. 認証ヘッダー生成
AUTH=$(echo -n "${KINTONE_USERNAME}:${KINTONE_PASSWORD}" | base64)

# 3. 接続テスト
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "${KINTONE_DOMAIN}/k/v1/apps.json?limit=1" \
  -H "X-Cybozu-Authorization: ${AUTH}")

if [ "$RESPONSE" != "200" ]; then
  echo "kintone接続エラー (HTTP $RESPONSE)"
  exit 1
fi

echo "kintone接続確認完了"
```
