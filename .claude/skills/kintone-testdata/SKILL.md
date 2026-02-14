---
name: kintone-testdata
description: デプロイ済みkintoneアプリにテストデータを自動投入（3件）。
disable-model-invocation: true
---

# kintone テストデータ投入

デプロイ完了後、各アプリに3件のテストデータを自動投入します。

## CRITICAL: API呼び出し方法

**すべてのkintone操作はBashツールでcurlコマンドを直接実行してREST APIを呼び出すこと。**

シェルスクリプト（.shファイル）は使用しない。すべてのAPI呼び出しはBashツールで直接curlを実行する。

## 概要

このスキルは `/kintone-workflow` から自動的に呼び出されます。
ユーザー確認なしで、デプロイ済みアプリにテストデータを投入します。

## 入力

- デプロイ済みアプリ情報（アプリID、アプリ名）
- フィールド設計書（フィールドタイプ・オプション情報）

## 投入件数

**固定3件**（確認なしで自動投入）

## Pre-flight Check（必須）

**curlでAPI操作する場合はバリデーションがないため、操作前に必ず実行する。**

```bash
# 1. 環境変数の確認
set -a && source .env && set +a

if [ -z "$KINTONE_DOMAIN" ] || [ -z "$KINTONE_USERNAME" ] || [ -z "$KINTONE_PASSWORD" ]; then
  echo "❌ 環境変数が設定されていません。.envファイルを確認してください。"
  exit 1
fi

# 2. 認証ヘッダー生成
AUTH=$(echo -n "${KINTONE_USERNAME}:${KINTONE_PASSWORD}" | base64)

# 3. 接続テスト
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "${KINTONE_DOMAIN}/k/v1/apps.json?limit=1" \
  -H "X-Cybozu-Authorization: ${AUTH}")

if [ "$RESPONSE" != "200" ]; then
  echo "❌ kintone接続エラー (HTTP $RESPONSE)"
  exit 1
fi

echo "✅ kintone接続確認完了"
```

## バリデーション（Layer 2: インライン関数）

**curlでAPI操作する場合はスキーマ検証がないため、API呼び出し前に必ずバリデーションを実行する。**

### バリデーション対象

| 項目 | 制限値 | 検証関数 |
|------|--------|----------|
| 一括登録レコード数 | 最大100件 | `validate_record_count` |
| 一括取得レコード数 | 最大500件 | `validate_get_limit` |
| アプリID | 正の整数 | `validate_app_id` |

### レコード件数検証（一括登録）

```bash
# レコード件数検証（一括登録用、API呼び出し前に実行）
validate_record_count() {
  local count="$1"
  if [ -z "$count" ]; then
    echo "❌ レコード件数は必須です" >&2
    return 1
  fi
  if ! [[ "$count" =~ ^[0-9]+$ ]]; then
    echo "❌ レコード件数は正の整数で指定してください: $count" >&2
    return 1
  fi
  if [ "$count" -lt 1 ]; then
    echo "❌ レコード件数は1以上を指定してください" >&2
    return 1
  fi
  if [ "$count" -gt 100 ]; then
    echo "❌ 一括登録は最大100件まで（指定: ${count}件）" >&2
    echo "   → 100件を超える場合は複数回に分割してください" >&2
    return 1
  fi
  echo "✓ レコード件数: $count 件"
  return 0
}

# 使用例（テストデータは固定3件なので常にOK）
RECORD_COUNT=3
validate_record_count "$RECORD_COUNT" || exit 1
```

### レコード件数検証（一括取得）

```bash
# レコード件数検証（一括取得用）
validate_get_limit() {
  local limit="$1"
  if [ -z "$limit" ]; then
    limit=100  # デフォルト値
  fi
  if ! [[ "$limit" =~ ^[0-9]+$ ]]; then
    echo "❌ 取得件数は正の整数で指定してください: $limit" >&2
    return 1
  fi
  if [ "$limit" -gt 500 ]; then
    echo "❌ 一括取得は最大500件まで（指定: ${limit}件）" >&2
    return 1
  fi
  echo "✓ 取得件数: $limit 件"
  return 0
}
```

### アプリID検証

```bash
# アプリID検証
validate_app_id() {
  local app_id="$1"
  if [ -z "$app_id" ]; then
    echo "❌ アプリIDは必須です" >&2
    return 1
  fi
  if ! [[ "$app_id" =~ ^[0-9]+$ ]]; then
    echo "❌ アプリIDは正の整数で指定してください: $app_id" >&2
    return 1
  fi
  echo "✓ アプリID: $app_id"
  return 0
}

# 使用例
APP_ID="123"
validate_app_id "$APP_ID" || exit 1
```

### APIエラー解析（Layer 3）

```bash
# APIレスポンス解析（レコード投入時）
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${KINTONE_DOMAIN}/k/v1/records.json" \
  -H "X-Cybozu-Authorization: ${AUTH}" \
  -H "Content-Type: application/json" \
  -d '{"app": "'"${APP_ID}"'", "records": [...]}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ レコード投入エラー (HTTP $HTTP_CODE)"

  # エラーコード別の対処法を表示
  case "$BODY" in
    *"CB_VA01"*)
      echo "  → フィールド値が不正です。データ形式を確認してください"
      ;;
    *"CB_NO02"*)
      echo "  → 指定されたアプリが見つかりません。アプリIDを確認してください"
      ;;
    *"GAIA_LO03"*)
      echo "  → ルックアップ参照先フィールドに「値の重複を禁止する」設定が必要です"
      echo "  → 参照先アプリのキーフィールドで unique: true を設定してください"
      ;;
    *"GAIA_RE18"*)
      echo "  → ルックアップで参照先に該当レコードが見つかりません"
      echo "  → 参照先アプリにレコードを先に登録してください"
      ;;
    *"CB_IJ01"*)
      echo "  → 不正なJSON形式です。リクエストボディを確認してください"
      ;;
    *"GAIA_IL26"*)
      echo "  → 一括登録の上限（100件）を超えています"
      ;;
    *)
      echo "  → エラー詳細: $BODY"
      ;;
  esac
  return 1
fi

echo "✅ レコード投入成功"
```

### 設計書のLayer 1チェックポイント

LLMがテストデータ投入前に確認：

| チェック項目 | 確認内容 |
|-------------|----------|
| 投入件数 | 固定3件（100件以内なのでOK） |
| 投入順序 | ルックアップ参照先を先に投入 |
| 必須フィールド | すべての必須フィールドにデータを設定 |
| フィールド型 | フィールドタイプに応じた適切なデータ形式 |

## 実行手順

### 0. 事前検証（CRITICAL）

テストデータ投入前に、ルックアップフィールドの参照先設定を検証します。

```
ルックアップフィールドがある場合:
├── 参照先アプリのフィールド情報をREST APIで取得
├── キーフィールドのunique設定を確認
│   ├── unique: true → OK、投入続行
│   └── unique: false → 警告を出し、手動設定を案内
│       └── 投入をスキップ（GAIA_LO03エラー回避）
```

**検証コード（REST API）**:
```bash
# フィールド情報取得
curl -s -X GET "${KINTONE_DOMAIN}/k/v1/app/form/fields.json?app=${RELATED_APP_ID}" \
  -H "X-Cybozu-Authorization: ${AUTH}" | jq '.properties["キーフィールド名"].unique'

# unique: falseの場合は警告を出しスキップ
```

### 1. 投入順序の決定

ルックアップの依存関係を考慮して投入順序を決定：

```
1. 依存関係のないマスタアプリから投入
2. 参照先にデータが入った後、参照元アプリに投入
```

### 2. テストデータ生成

フィールドタイプごとに適切なサンプルデータを生成：

| フィールドタイプ | 生成ルール | 例 |
|-----------------|----------|-----|
| SINGLE_LINE_TEXT | 「{ラベル}_{連番}」形式 | 「顧客名_1」「顧客名_2」 |
| MULTI_LINE_TEXT | 「{ラベル}のサンプルテキストです。\n2行目」 | |
| RICH_TEXT | 「<p>{ラベル}のサンプル</p>」 | |
| NUMBER | 連番 × 1000（minValue〜maxValue範囲内） | 1000, 2000, 3000 |
| DROP_DOWN | optionsから順番に選択（ループ） | |
| RADIO_BUTTON | optionsから順番に選択（ループ） | |
| CHECK_BOX | optionsから1〜2個選択 | |
| MULTI_SELECT | optionsから1〜2個選択 | |
| DATE | 今日、昨日、一昨日 | 「2026-02-05」「2026-02-04」 |
| DATETIME | 今日9:00、昨日10:00、一昨日11:00 | |
| TIME | 「09:00」「10:00」「11:00」 | |
| LINK (WEB) | 「https://example.com/{連番}」 | |
| LINK (MAIL) | 「test{連番}@example.com」 | |
| LINK (CALL) | 「090-0000-000{連番}」 | |
| USER_SELECT | 空配列（ユーザー情報不明のため） | [] |
| ORGANIZATION_SELECT | 空配列 | [] |
| GROUP_SELECT | 空配列 | [] |
| FILE | スキップ（API制限） | - |
| LOOKUP | 参照先から取得したキー値 | |

### 3. ルックアップフィールドの処理

**REST APIでレコードを取得し、キー値を抽出する：**

```bash
# 参照先アプリのレコードを取得
RECORDS=$(curl -s -X GET "${KINTONE_DOMAIN}/k/v1/records.json?app=${RELATED_APP_ID}&query=limit%203" \
  -H "X-Cybozu-Authorization: ${AUTH}")

# キー値を抽出（例：customer_idフィールド）
echo "$RECORDS" | jq -r '.records[].customer_id.value'
```

- レコードがある場合 → キー値を順番に使用（1件目→1番目、2件目→2番目...）
- レコードがない場合 → 先に参照先にテストデータを投入済みのはず

### 4. レコード投入

**REST APIでレコードを追加する：**

```bash
# レコード投入
curl -s -X POST "${KINTONE_DOMAIN}/k/v1/records.json" \
  -H "X-Cybozu-Authorization: ${AUTH}" \
  -H "Content-Type: application/json" \
  -d '{
    "app": "'${APP_ID}'",
    "records": [
      {
        "field1": {"value": "サンプル値1"},
        "field2": {"value": "サンプル値2"}
      },
      {
        "field1": {"value": "サンプル値3"},
        "field2": {"value": "サンプル値4"}
      },
      {
        "field1": {"value": "サンプル値5"},
        "field2": {"value": "サンプル値6"}
      }
    ]
  }'

# 結果確認
# 成功時: {"ids":["1","2","3"],"revisions":["1","1","1"]}
```

### 5. 進捗表示

```
テストデータ投入中...
  顧客マスタ: 3件投入完了 ✅
  受注管理: 3件投入完了 ✅
```

## 出力

### 投入結果レポート

```
## テストデータ投入完了

| アプリ名 | アプリID | 投入件数 | 状態 |
|----------|----------|----------|------|
| 顧客マスタ | 123 | 3件 | ✅ 成功 |
| 受注管理 | 124 | 3件 | ✅ 成功 |
```

## エラー処理

### 投入失敗時

- 処理を継続（成功分は保持）
- 失敗したアプリは警告表示
- ワークフロー全体は正常完了扱い

```
テストデータ投入中...
  顧客マスタ: 3件投入完了 ✅
  受注管理: 投入失敗 ⚠️（エラー: フィールド値が不正）
```

### GAIA_LO03エラー（ルックアップ参照先の重複禁止設定なし）

**原因**: ルックアップ参照先フィールドに「値の重複を禁止する」設定がない
**対処**:
1. 事前検証でこのエラーを防ぐ（投入前にスキップ）
2. エラー発生時は以下を表示:
   ```
   ⚠️ ルックアップエラー: 参照先アプリの設定が必要です

   手動設定手順:
   1. [参照先アプリURL]/admin/form を開く
   2. [キーフィールド名]の設定で「値の重複を禁止する」にチェック
   3. 「アプリを更新」をクリック
   4. テストデータを手動で投入してください
   ```

### スキップされるケース

- FILE フィールドのみのアプリ（投入不可）
- 全フィールドが自動計算のアプリ
- **ルックアップ参照先にunique設定がないアプリ**（GAIA_LO03回避）

## 注意事項

1. **確認なし**: ユーザー確認なしで自動実行
2. **固定3件**: 投入件数は固定
3. **冪等性なし**: 再実行するとデータが追加される
4. **削除機能なし**: 投入したデータの自動削除は非対応

## 認証情報ファイル構成

### ファイル構成

```
project-root/
├── .env                         # 認証情報（gitignore対象）
└── .gitignore
```

### .env（gitignore対象）

```env
KINTONE_DOMAIN=https://xxx.cybozu.com
KINTONE_USERNAME=your-username
KINTONE_PASSWORD=your-password
```

**前提条件**: なし（jq不要、.envから直接読み込み）

**セキュリティ**: `.env` は `.gitignore` に追加されています。絶対にコミットしないでください。
