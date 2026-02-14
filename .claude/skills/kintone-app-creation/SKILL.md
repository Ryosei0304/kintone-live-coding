---
name: kintone-app-creation
description: Phase 3: kintoneアプリ作成。アプリ設計書・フィールド設計書からkintoneアプリを自動構築します。優先度順によるアプリ間依存解決、フィールド作成、レイアウト調整を行います。
disable-model-invocation: true
---

# kintoneアプリ作成

設計書からkintoneアプリを自動構築します。

## CRITICAL: API呼び出し方法

**すべてのkintone操作はBashツールでcurlコマンドを直接実行してREST APIを呼び出すこと。**

シェルスクリプト（.shファイル）は使用しない。すべてのAPI呼び出しはBashツールで直接curlを実行する。

## 概要

アプリ設計書、フィールド設計書をもとに：
1. kintoneアプリの箱を作成
2. フィールドを作成（優先度順によるアプリ間依存解決）
3. フォームレイアウトを調整
4. 本番環境にデプロイ

## 入力要件

### 必須
1. **kintone認証情報**: `.env` ファイル
2. **アプリ設計書**: アプリ一覧とアプリ間連携情報
3. **フィールド設計書**: 各アプリのフィールド定義

### オプション
4. **スペースID**: アプリを作成するスペースのID（指定しない場合はポータル直下に作成）
   - ※ kintone REST APIではスペース作成がサポートされていないため、事前にkintone管理画面でスペースを作成しておく必要がある

## 認証情報の取得

**Bashツールで以下のコマンドを実行して認証情報を取得する：**

```bash
# .env を読み込み
set -a && source .env && set +a

# 認証ヘッダーを生成
AUTH=$(echo -n "${KINTONE_USERNAME}:${KINTONE_PASSWORD}" | base64)

echo "Domain: $KINTONE_DOMAIN"
echo "Auth: Set"
```

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
| アプリ名 | 最大64文字、必須 | `validate_app_name` |
| フィールドコード | 最大128文字、数字始まり禁止、必須 | `validate_field_code` |
| フィールドラベル | 最大128文字 | `validate_field_label` |
| 一括フィールド追加 | 最大100フィールド | - |

### アプリ名検証

```bash
# アプリ名検証（API呼び出し前に実行）
validate_app_name() {
  local name="$1"
  if [ -z "$name" ]; then
    echo "❌ アプリ名は必須です" >&2
    return 1
  fi
  if [ ${#name} -gt 64 ]; then
    echo "❌ アプリ名は64文字以内（現在: ${#name}文字）" >&2
    return 1
  fi
  echo "✓ アプリ名: $name"
  return 0
}

# 使用例
APP_NAME="顧客マスタ"
validate_app_name "$APP_NAME" || exit 1
```

### フィールドコード検証

```bash
# フィールドコード検証（API呼び出し前に実行）
validate_field_code() {
  local code="$1"
  if [ -z "$code" ]; then
    echo "❌ フィールドコードは必須です" >&2
    return 1
  fi
  if [ ${#code} -gt 128 ]; then
    echo "❌ フィールドコードは128文字以内（現在: ${#code}文字）" >&2
    return 1
  fi
  if [[ "$code" =~ ^[0-9] ]]; then
    echo "❌ フィールドコードは数字で始められません: $code" >&2
    return 1
  fi
  if [[ ! "$code" =~ ^[a-zA-Z0-9_]+$ ]]; then
    echo "❌ フィールドコードは半角英数字とアンダースコアのみ使用可能: $code" >&2
    return 1
  fi
  echo "✓ フィールドコード: $code"
  return 0
}

# 使用例
FIELD_CODE="customer_name"
validate_field_code "$FIELD_CODE" || exit 1
```

### フィールドラベル検証

```bash
# フィールドラベル検証
validate_field_label() {
  local label="$1"
  if [ ${#label} -gt 128 ]; then
    echo "❌ フィールドラベルは128文字以内（現在: ${#label}文字）" >&2
    return 1
  fi
  echo "✓ フィールドラベル: $label"
  return 0
}
```

### APIエラー解析（Layer 3）

```bash
# APIレスポンス解析（curlコマンド実行後に使用）
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${KINTONE_DOMAIN}/k/v1/preview/app.json" \
  -H "X-Cybozu-Authorization: ${AUTH}" \
  -H "Content-Type: application/json" \
  -d '{"name": "'"${APP_NAME}"'"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ APIエラー (HTTP $HTTP_CODE)"

  # エラーコード別の対処法を表示
  case "$BODY" in
    *"CB_VA01"*)
      echo "  → 入力値が不正です。アプリ名やフィールドコードを確認してください"
      ;;
    *"CB_NO02"*)
      echo "  → 指定されたアプリが見つかりません。アプリIDを確認してください"
      ;;
    *"GAIA_LO03"*)
      echo "  → ルックアップ参照先フィールドに「値の重複を禁止する」設定が必要です"
      echo "  → 参照先アプリのキーフィールドで unique: true を設定してください"
      ;;
    *"GAIA_AP01"*)
      echo "  → アプリの操作権限がありません。kintoneシステム管理者権限を確認してください"
      ;;
    *"CB_IJ01"*)
      echo "  → 不正なJSON形式です。リクエストボディを確認してください"
      ;;
    *"GAIA_IL23"*)
      echo "  → フィールドコードが重複しています。一意なコードを指定してください"
      ;;
    *)
      echo "  → エラー詳細: $BODY"
      ;;
  esac
  exit 1
fi

echo "✅ API呼び出し成功"
APP_ID=$(echo "$BODY" | grep -o '"app":"[^"]*"' | cut -d'"' -f4)
```

### 設計書のLayer 1チェックポイント

LLMが設計書を読む時点で以下を検証：

| チェック項目 | 制限値 | 確認方法 |
|-------------|--------|----------|
| アプリ名の長さ | 64文字以内 | 設計書のアプリ名を確認 |
| フィールドコードの形式 | 128文字以内、英数字_のみ | フィールド設計書を確認 |
| フィールドコードの重複 | アプリ内で一意 | フィールド一覧を確認 |
| 参照先アプリの存在 | 依存関係で確認 | アプリ設計書を確認 |
| 循環参照 | なし | 依存関係で確認 |

## 処理フロー

### Phase 1: アプリ作成

1. **認証情報の検証**
   - REST APIで接続確認

2. **デプロイ先の確認**
   - スペースID指定あり → スペース内に作成
   - スペースID指定なし → ポータル直下に作成

3. **アプリの箱を作成**
   - アプリ設計書からアプリ名を抽出
   - 各アプリを作成（プレビュー環境）
   - スペースIDが指定されている場合は `space` パラメータを付与

### Phase 2: フィールド作成（優先度順に依存解決）

フィールド作成は以下の2パスで実行：

#### Pass 1: 基本フィールド
- 文字列（1行）、数値、日付、ドロップダウンなど
- アプリ間連携を持たないフィールド
- **ルックアップキーフィールドにはunique: trueを設定**

#### Pass 2: 連携フィールド（優先度順）
- **ルックアップ**: 他アプリの値を参照
- **関連レコード一覧**: 関連レコードを表示

> **⚠️ CRITICAL: Pass 2内での中間デプロイ**
>
> ルックアップ/関連レコード一覧を追加する際、**参照先フィールドがデプロイ済み**でないとGAIA_FC01エラーが発生する。
>
> **中間デプロイが必要なケース：**
> 1. アプリAにルックアップを追加 → **アプリAをデプロイ** → アプリBにアプリAを参照するルックアップ/関連レコードを追加
> 2. 関連レコード一覧の条件フィールドがルックアップの場合 → **そのルックアップを含むアプリをデプロイ** → 関連レコード一覧を追加
>
> **Pass 2の正しい手順：**
> ```
> 1. 優先度順でルックアップフィールドを追加
> 2. ルックアップを追加したアプリを即座にデプロイ ★重要
> 3. 次のルックアップ/関連レコードを追加
> 4. 追加したアプリをデプロイ ★重要
> 5. 全ての連携フィールド追加完了まで繰り返し
> 6. 最終デプロイ
> ```

#### 依存関係の解決

```
依存関係の確認ルール:
1. LOOKUP: relatedKeyField + fieldMappings への依存
2. REFERENCE_TABLE: condition.relatedField + displayFields への依存
3. 循環参照を検出した場合はエラー

優先度順の決定:
- マスタアプリ（参照先）を先に作成
- 参照元アプリを後に作成
- 依存先が先に作成されることを保証
```

#### アプリ間依存の解決

```
例: 顧客マスタ → 案件管理（ルックアップ）→ 見積管理（関連レコード一覧）

作成順序:
1. 顧客マスタの基本フィールド
2. 案件管理の基本フィールド
3. 見積管理の基本フィールド
4. 全アプリ → デプロイ
5. 案件管理のルックアップ
6. 見積管理の関連レコード一覧
7. 全アプリ → 再デプロイ
```

### Phase 2.5: アプリ説明文の設定

Pass 1のアプリ作成・デプロイ後に、各アプリの説明文を設定する。

```bash
# アプリ説明文の設定
curl -s -X PUT "${KINTONE_DOMAIN}/k/v1/preview/app/settings.json" \
  -H "X-Cybozu-Authorization: ${AUTH}" \
  -H "Content-Type: application/json" \
  -d '{
    "app": "'"${APP_ID}"'",
    "description": "'"${APP_DESCRIPTION}"'"
  }'
```

※ 説明文はHTML形式で設定可能
※ アプリ設計書の「アプリの説明文（HTML）」をそのまま設定する

### Phase 3: レイアウト調整

1. **フォームレイアウト取得**
   - 現在のレイアウトを取得

2. **レイアウト最適化**
   - フィールド設計書の順序に基づき配置
   - グループ、テーブルの配置
   - **スペーサーフィールドの配置**（セクション見出し用）
   - **入力ガイドラベルの配置**（LABELフィールドとして配置）

3. **レイアウト更新・デプロイ**

#### ラベルフィールドの配置

ラベルはフォームレイアウトAPIで直接配置する（フィールド追加APIは不要）。

```bash
# レイアウト内にLABELを配置する例
{
  "type": "ROW",
  "fields": [
    {
      "type": "LABEL",
      "label": "取得ボタンを押して選択してください",
      "size": {"width": "300"}
    }
  ]
}
```

#### スペーサーフィールドの配置

スペーサーもレイアウトAPIで配置し、`style_section_header` カスタマイズで見出しスタイルを適用する。

```bash
# レイアウト内にスペーサーを配置する例
{
  "type": "ROW",
  "fields": [
    {
      "type": "SPACER",
      "elementId": "space_basic_info",
      "size": {"width": "700", "height": "30"}
    }
  ]
}
```

#### 横並びにすべきフィールドパターン

| パターン | フィールド例 | 1行あたり |
|----------|-------------|----------|
| **ペア項目** | 開始日 + 終了日 | 2個 |
| **名前** | 姓 + 名 | 2個 |
| **住所** | 都道府県 + 市区町村 + 番地 | 2-3個 |
| **金額** | 単価 + 数量 + 小計 | 3個 |
| **連絡先** | 電話 + メール | 2個 |
| **ルックアップ後** | 自動コピーされるフィールド群 | 2-3個 |
| **短いフィールド** | ステータス + 優先度 | 2-3個 |

#### 横並びにしないフィールド（1行1個）

- 複数行テキスト（MULTI_LINE_TEXT）
- リッチエディタ（RICH_TEXT）
- テーブル（SUBTABLE）
- 関連レコード一覧（REFERENCE_TABLE）
- 長い選択肢のドロップダウン

#### 幅の設定ガイド

| フィールド数/行 | 各フィールド幅目安 |
|----------------|-------------------|
| 2フィールド | 各250-350px |
| 3フィールド | 各150-200px |
| 4フィールド | 各120-150px |

## REST API Operations

### アプリ作成

```bash
# ポータル直下に作成（スペース未指定）
curl -s -X POST "${KINTONE_DOMAIN}/k/v1/preview/app.json" \
  -H "X-Cybozu-Authorization: ${AUTH}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "顧客マスタ"
  }'

# スペース内に作成（スペースID指定）
curl -s -X POST "${KINTONE_DOMAIN}/k/v1/preview/app.json" \
  -H "X-Cybozu-Authorization: ${AUTH}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "顧客マスタ",
    "space": 123
  }'
```

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| `name` | ✅ | アプリ名（最大64文字） |
| `space` | ❌ | スペースID（既存スペースのみ、REST APIでスペース作成は不可） |
| `thread` | ❌ | スレッドID（マルチスレッドスペースの場合） |

### フィールド追加

```bash
curl -s -X POST "${KINTONE_DOMAIN}/k/v1/preview/app/form/fields.json" \
  -H "X-Cybozu-Authorization: ${AUTH}" \
  -H "Content-Type: application/json" \
  -d '{
    "app": "123",
    "properties": {
      "customer_name": {
        "type": "SINGLE_LINE_TEXT",
        "code": "customer_name",
        "label": "顧客名",
        "required": true
      }
    }
  }'
```

### フィールド取得

```bash
curl -s -X GET "${KINTONE_DOMAIN}/k/v1/app/form/fields.json?app=${APP_ID}" \
  -H "X-Cybozu-Authorization: ${AUTH}"
```

### フォームレイアウト更新

```bash
curl -s -X PUT "${KINTONE_DOMAIN}/k/v1/preview/app/form/layout.json" \
  -H "X-Cybozu-Authorization: ${AUTH}" \
  -H "Content-Type: application/json" \
  -d '{
    "app": "123",
    "layout": [
      {
        "type": "ROW",
        "fields": [
          {"type": "SINGLE_LINE_TEXT", "code": "customer_name", "size": {"width": "300"}},
          {"type": "DROP_DOWN", "code": "status", "size": {"width": "150"}}
        ]
      }
    ]
  }'
```

### アプリデプロイ

```bash
curl -s -X POST "${KINTONE_DOMAIN}/k/v1/preview/app/deploy.json" \
  -H "X-Cybozu-Authorization: ${AUTH}" \
  -H "Content-Type: application/json" \
  -d '{
    "apps": [{"app": "123"}]
  }'
```

### デプロイ状況確認

```bash
curl -s -X GET "${KINTONE_DOMAIN}/k/v1/preview/app/deploy.json?apps[0]=123" \
  -H "X-Cybozu-Authorization: ${AUTH}"
```

## kintoneフィールドタイプ対応表

| 設計書での名称 | kintone API type | 備考 |
|---------------|------------------|------|
| 文字列（1行） | SINGLE_LINE_TEXT | |
| 文字列（複数行） | MULTI_LINE_TEXT | |
| リッチエディター | RICH_TEXT | |
| 数値 | NUMBER | |
| 日付 | DATE | |
| 日時 | DATETIME | |
| 時刻 | TIME | |
| ドロップダウン | DROP_DOWN | options必須 |
| ラジオボタン | RADIO_BUTTON | options必須 |
| チェックボックス | CHECK_BOX | options必須 |
| 複数選択 | MULTI_SELECT | options必須 |
| ユーザー選択 | USER_SELECT | |
| 組織選択 | ORGANIZATION_SELECT | |
| グループ選択 | GROUP_SELECT | |
| 添付ファイル | FILE | |
| リンク | LINK | protocol必須 |
| テーブル | SUBTABLE | fields必須、**個別フィールド更新不可（下記参照）** |
| ルックアップ | SINGLE_LINE_TEXT/NUMBER + lookup | |
| 関連レコード一覧 | REFERENCE_TABLE | referenceTable必須 |

> **⚠️ サブテーブル（SUBTABLE）の更新制約**
>
> サブテーブル内のフィールドを個別に更新することはできない（CB_VA01エラー）。
> サブテーブル内にルックアップを追加する場合は、**サブテーブル全体を再定義**して更新する必要がある。
>
> ```json
> // ❌ NG: テーブル内フィールドのみを指定
> {
>   "properties": {
>     "商品名": { "type": "SINGLE_LINE_TEXT", "lookup": {...} }
>   }
> }
>
> // ✅ OK: サブテーブル全体を再定義
> {
>   "properties": {
>     "明細テーブル": {
>       "type": "SUBTABLE",
>       "code": "明細テーブル",
>       "label": "明細テーブル",
>       "fields": {
>         "商品名": { "type": "SINGLE_LINE_TEXT", "code": "商品名", "label": "商品名", "lookup": {...} },
>         "数量": { "type": "NUMBER", "code": "数量", "label": "数量" },
>         "金額": { "type": "NUMBER", "code": "金額", "label": "金額" }
>       }
>     }
>   }
> }
> ```

## フィールドプロパティ仕様

### 共通プロパティ
```json
{
  "type": "SINGLE_LINE_TEXT",
  "code": "顧客名",
  "label": "顧客名",
  "noLabel": false,
  "required": false
}
```

### 選択肢フィールド（DROP_DOWN/RADIO_BUTTON/CHECK_BOX/MULTI_SELECT）
```json
{
  "type": "DROP_DOWN",
  "code": "ステータス",
  "label": "ステータス",
  "options": {
    "未着手": {"label": "未着手", "index": "0"},
    "進行中": {"label": "進行中", "index": "1"},
    "完了": {"label": "完了", "index": "2"}
  }
}
```

### ルックアップ
```json
{
  "type": "SINGLE_LINE_TEXT",
  "code": "顧客名",
  "label": "顧客名",
  "lookup": {
    "relatedApp": {"app": "123"},
    "relatedKeyField": "顧客コード",
    "fieldMappings": [
      {"field": "顧客住所", "relatedField": "住所"}
    ],
    "lookupPickerFields": ["顧客名", "住所"],
    "filterCond": "",
    "sort": ""
  }
}
```

### 関連レコード一覧
```json
{
  "type": "REFERENCE_TABLE",
  "code": "関連案件",
  "label": "関連案件",
  "referenceTable": {
    "relatedApp": {"app": "456"},
    "condition": {
      "field": "顧客コード",
      "relatedField": "顧客コード"
    },
    "filterCond": "",
    "displayFields": ["案件名", "ステータス", "金額"],
    "sort": "更新日時 desc",
    "size": "5"
  }
}
```

### Phase 3.5: ビュー作成

レイアウト調整後、デプロイ前にビューを作成する。

```bash
# ビュー作成
curl -s -X PUT "${KINTONE_DOMAIN}/k/v1/preview/app/views.json" \
  -H "X-Cybozu-Authorization: ${AUTH}" \
  -H "Content-Type: application/json" \
  -d '{
    "app": "'"${APP_ID}"'",
    "views": {
      "（すべて）": {
        "index": "0",
        "type": "LIST",
        "name": "（すべて）",
        "fields": ["customer_name", "status", "updated_datetime"],
        "sort": "更新日時 desc"
      },
      "未対応のみ": {
        "index": "1",
        "type": "LIST",
        "name": "未対応のみ",
        "fields": ["customer_name", "status", "updated_datetime"],
        "filterCond": "status in (\"未対応\")",
        "sort": "更新日時 desc"
      }
    }
  }'
```

※ フィールド設計書のビュー設計セクションに基づいてビューを作成する
※ ビュー作成後にアプリをデプロイすること

## エラーハンドリング

### 認証エラー（401）
- ユーザーID/パスワードの再入力を促す

### 権限エラー（403）
- 必要な権限を案内
- kintoneシステム管理者権限が必要

### 循環参照エラー
- 依存グラフで循環を検出
- 該当フィールドを特定して報告

### APIエラー（400）
- リクエストボディをログ出力
- 詳細なエラーメッセージを表示

## 実行手順

### 1. 設計書の確認

```
設計書を確認します：

必須:
1. アプリ設計書
2. フィールド設計書
```

### 2. 設計内容の確認

```
設計書を解析しました。以下の内容で作成します：

【作成するアプリ】（3個）
  1. 顧客マスタ
  2. 案件管理
  3. 見積管理

【アプリ間連携】
  - 案件管理 → 顧客マスタ（ルックアップ: 顧客名）
  - 見積管理 → 案件管理（関連レコード一覧）

この内容で作成を開始しますか？
```

### 3. 進捗表示

```
[Phase 1] アプリ作成
  デプロイ先: スペース(ID: 123) / ポータル直下
  ✓ アプリ作成完了:
    - 顧客マスタ (ID: 123)
    - 案件管理 (ID: 124)
    - 見積管理 (ID: 125)

[Phase 2] フィールド作成
  ✓ 依存グラフ構築完了
  ✓ Pass 1: 基本フィールド作成完了
  ✓ 全アプリデプロイ完了
  ✓ Pass 2: 連携フィールド作成完了
    - 顧客マスタ → 案件管理 (ルックアップ)
    - 案件管理 → 見積管理 (関連レコード一覧)

[Phase 2.5] アプリ説明文設定
  ✓ 顧客マスタ: 説明文設定完了
  ✓ 案件管理: 説明文設定完了
  ✓ 見積管理: 説明文設定完了

[Phase 3] レイアウト調整
  ✓ スペーサー・ラベル配置完了
  ✓ レイアウト更新完了

[Phase 3.5] ビュー作成
  ✓ 顧客マスタ: 2ビュー作成
  ✓ 案件管理: 3ビュー作成
  ✓ 見積管理: 2ビュー作成

  ✓ 本番デプロイ完了

完了！
```

## セルフチェックリスト

- [ ] アプリ設計書のアプリ名が一意か
- [ ] フィールド設計書のフィールドコードが一意か
- [ ] ルックアップ/関連レコード一覧の参照先アプリが存在するか
- [ ] 循環参照がないか
- [ ] 選択肢フィールドにoptionsが設定されているか
- [ ] テーブル内にルックアップ/関連レコード一覧を配置していないか
- [ ] ルックアップキーフィールドにunique: trueが設定されているか

## 制約事項

- 一度に作成できるアプリ数: 最大100個
- 一度に作成できるフィールド数: アプリあたり最大500個

## 使用しない条件

- アプリ設計書またはフィールド設計書がない場合
- kintone認証情報が取得できない場合

## トラブルシューティング

### 「認証に失敗しました」
- `.env` ファイルのKINTONE_USERNAME/KINTONE_PASSWORDを確認
- cybozu.com共通管理者権限があるか確認

### 「循環参照が検出されました」
- エラーメッセージで示されたフィールドを確認
- ルックアップ/関連レコード一覧の設計を見直し

### 「フィールド作成に失敗しました」
- フィールドプロパティの形式を確認
- 必須プロパティ（options, lookup, referenceTable等）が設定されているか確認

### 「デプロイに失敗しました」
- アプリ管理権限があるか確認
- 他のユーザーが編集中でないか確認

### 「GAIA_LO03エラー」
- ルックアップ参照先フィールドにunique: trueが設定されているか確認
- Pass 1でunique設定を行っているか確認

### 「GAIA_FC01エラー」（指定されたフィールドが見つかりません）
- **原因**: ルックアップ/関連レコード一覧の参照先フィールドがデプロイされていない
- **対処法**:
  1. 参照先アプリがデプロイ済みか確認
  2. 参照先フィールド（特にルックアップフィールド）がデプロイ済みか確認
  3. Pass 2内で中間デプロイを実行してから再試行
- **例**: 顧客マスタに企業名ルックアップを追加 → 顧客マスタをデプロイ → 営業案件に顧客名ルックアップを追加

### 「CB_VA01エラー」（テーブルからフィールドを出すことはできません）
- **原因**: サブテーブル内のフィールドを個別に更新しようとした
- **対処法**: サブテーブル全体を再定義して更新する
  - `kintone-update-form-fields`でサブテーブル内フィールドのみを指定するとこのエラーが発生
  - サブテーブルの`fields`プロパティに全フィールドを含めて更新すること

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
