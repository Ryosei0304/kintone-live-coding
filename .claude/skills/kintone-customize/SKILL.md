---
name: kintone-customize
description: Phase 3.5: 設計書からカスタマイズ要件を読み取り、パターンベースでJavaScript/CSSを生成してkintoneに適用。
---

# Phase 3.5: カスタマイズ適用

設計書のカスタマイズ要件からパターンベースでコードを生成し、kintoneに適用します。

## CRITICAL: API呼び出し方法

**kintone MCPサーバーにはファイルアップロードやカスタマイズ設定のツールがないため、Bashツールでcurlコマンドを直接実行してREST APIを呼び出すこと。**

シェルスクリプト（.shファイル）は使用しない。すべてのAPI呼び出しはBashツールで直接curlを実行する。

## 概要

このスキルは `/kintone-workflow` から呼び出され、以下を実行します：
1. 既存カスタマイズの確認（あればスキップ）- Bashでcurl直接実行
2. 設計書からカスタマイズ要件を読み取り
3. パターンカタログから適切なパターンを選択
4. パラメータを埋め込んでコード生成
5. **Bashツールでcurlを直接実行**してkintoneにアップロード・適用

## 入力

- デプロイ済みアプリのID
- フィールド設計書（`フィールド設計書_${Project}_${Date}.md`）
- カスタマイズ要件（設計書内のカスタマイズ設計セクション）

## 前提条件チェック

### 1. 認証情報の取得

**Bashツールで以下のコマンドを実行して認証情報を取得する：**

```bash
# .env を読み込み
set -a && source .env && set +a

# 認証ヘッダーを生成
AUTH_HEADER="X-Cybozu-Authorization: $(echo -n "${KINTONE_USERNAME}:${KINTONE_PASSWORD}" | base64)"

echo "Domain: $KINTONE_DOMAIN"
echo "Auth Header: Set"
```

### 1.5. Pre-flight Check（必須）

**MCPツールと異なり、REST API直接呼び出しではバリデーションがないため、API操作前に必ず実行する。**

```bash
# 環境変数の確認
if [ -z "$KINTONE_DOMAIN" ] || [ -z "$KINTONE_USERNAME" ] || [ -z "$KINTONE_PASSWORD" ]; then
  echo "❌ 環境変数が設定されていません。.envファイルを確認してください。"
  exit 1
fi

# 接続テスト
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "${KINTONE_DOMAIN}/k/v1/apps.json?limit=1" \
  -H "${AUTH_HEADER}")

if [ "$RESPONSE" != "200" ]; then
  echo "❌ kintone接続エラー (HTTP $RESPONSE)"
  exit 1
fi

echo "✅ kintone接続確認完了"
```

## バリデーション（Layer 2: インライン関数）

**MCPツールと異なり、REST API直接呼び出しではスキーマ検証がないため、API呼び出し前に必ずバリデーションを実行する。**

### バリデーション対象

| 項目 | 制限値 | 検証関数 |
|------|--------|----------|
| カスタマイズファイルサイズ | 最大10MB | `validate_file_size` |
| ファイル拡張子 | .js または .css | `validate_file_extension` |
| アプリID | 正の整数 | `validate_app_id` |

### ファイルサイズ検証

```bash
# ファイルサイズ検証（API呼び出し前に実行）
validate_file_size() {
  local file_path="$1"
  local max_size_mb=10
  local max_size_bytes=$((max_size_mb * 1024 * 1024))

  if [ ! -f "$file_path" ]; then
    echo "❌ ファイルが見つかりません: $file_path" >&2
    return 1
  fi

  local file_size=$(stat -f%z "$file_path" 2>/dev/null || stat -c%s "$file_path" 2>/dev/null)

  if [ "$file_size" -gt "$max_size_bytes" ]; then
    local size_mb=$(echo "scale=2; $file_size / 1024 / 1024" | bc)
    echo "❌ ファイルサイズが上限を超えています" >&2
    echo "   上限: ${max_size_mb}MB、現在: ${size_mb}MB" >&2
    echo "   → ファイルを圧縮するか、分割してください" >&2
    return 1
  fi

  local size_kb=$(echo "scale=2; $file_size / 1024" | bc)
  echo "✓ ファイルサイズ: ${size_kb}KB ($file_path)"
  return 0
}

# 使用例
validate_file_size "outputs/プロジェクト名/customize_アプリ名.js" || exit 1
```

### ファイル拡張子検証

```bash
# ファイル拡張子検証
validate_file_extension() {
  local file_path="$1"
  local extension="${file_path##*.}"

  case "$extension" in
    js|css)
      echo "✓ ファイル形式: .$extension"
      return 0
      ;;
    *)
      echo "❌ カスタマイズファイルは .js または .css のみ対応" >&2
      echo "   指定されたファイル: $file_path" >&2
      return 1
      ;;
  esac
}

# 使用例
validate_file_extension "customize_顧客管理.js" || exit 1
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
```

### APIエラー解析（Layer 3）

```bash
# ファイルアップロードのレスポンス解析
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${KINTONE_DOMAIN}/k/v1/file.json" \
  -H "X-Cybozu-Authorization: ${AUTH}" \
  -F "file=@${FILE_PATH}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ ファイルアップロードエラー (HTTP $HTTP_CODE)"

  # エラーコード別の対処法を表示
  case "$BODY" in
    *"CB_VA01"*)
      echo "  → ファイル形式が不正です。.jsまたは.cssファイルを指定してください"
      ;;
    *"CB_NO02"*)
      echo "  → アプリが見つかりません。アプリIDを確認してください"
      ;;
    *"GAIA_AP01"*)
      echo "  → アプリの操作権限がありません。kintoneシステム管理者権限を確認してください"
      ;;
    *"CB_FE01"*)
      echo "  → ファイルサイズが上限（10MB）を超えています"
      echo "  → ファイルを圧縮するか、分割してください"
      ;;
    *"CB_IJ01"*)
      echo "  → 不正なリクエスト形式です"
      ;;
    *)
      echo "  → エラー詳細: $BODY"
      ;;
  esac
  exit 1
fi

FILE_KEY=$(echo "$BODY" | grep -o '"fileKey":"[^"]*"' | cut -d'"' -f4)
echo "✅ ファイルアップロード成功: $FILE_KEY"
```

### カスタマイズ設定のレスポンス解析

```bash
# カスタマイズ設定のレスポンス解析
RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "${KINTONE_DOMAIN}/k/v1/preview/app/customize.json" \
  -H "X-Cybozu-Authorization: ${AUTH}" \
  -H "Content-Type: application/json" \
  -d '{"app": "'"${APP_ID}"'", "desktop": {"js": [{"type": "FILE", "file": {"fileKey": "'"${FILE_KEY}"'"}}]}}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ カスタマイズ設定エラー (HTTP $HTTP_CODE)"

  case "$BODY" in
    *"GAIA_AP01"*)
      echo "  → アプリの操作権限がありません"
      ;;
    *"CB_NO02"*)
      echo "  → アプリが見つかりません"
      ;;
    *"CB_VA01"*)
      echo "  → 設定値が不正です。fileKeyを確認してください"
      ;;
    *)
      echo "  → エラー詳細: $BODY"
      ;;
  esac
  exit 1
fi

echo "✅ カスタマイズ設定成功"
```

### 設計書のLayer 1チェックポイント

LLMがカスタマイズ適用前に確認：

| チェック項目 | 確認内容 |
|-------------|----------|
| 既存カスタマイズ | desktop.js/cssが空であること |
| パターン対応 | 要件がパターンカタログに存在すること |
| フィールドコード | 指定されたフィールドがアプリに存在すること |
| ファイルサイズ | 生成コードが10MB未満であること |

### 2. 既存カスタマイズの確認

**CRITICAL**: 既存のカスタマイズがある場合はスキップする。

```bash
# Bashツールで直接実行
curl -s -X GET "${KINTONE_DOMAIN}/k/v1/app/customize.json?app=${APP_ID}" \
  -H "${AUTH_HEADER}"
```

**判定ロジック**:
```
既存カスタマイズ確認:
├── desktop.js または desktop.css が存在
│   └── 警告を表示してスキップ
│       「既存のカスタマイズが検出されました。上書きを防ぐためスキップします。」
└── 存在しない
    └── カスタマイズ適用を続行
```

## パターンマッチング

### LLMによる要件理解

設計書のカスタマイズ要件を自然言語で解析し、適切なパターンを選択。

**パターンカタログ**: `templates/customize/catalog.json`

### マッチング例

```
要件: 「ステータスが完了の時、備考フィールドを編集不可にしたい」

↓ LLMが解析

選択パターン:
  - field_disable（フィールド編集不可制御）

パラメータ:
  - TRIGGER_FIELD: "ステータス"
  - CONDITION_VALUE: "完了"
  - TARGET_FIELDS: ["備考"]
  - DISABLE_WHEN_MATCH: true
```

```
要件: 「金額が10万円以上の時、承認者フィールドを表示したい」

↓ LLMが解析

選択パターン:
  - field_show_hide（フィールド表示/非表示制御）

※ 数値条件は現在のパターンでは未対応 → 警告表示
```

### 対応パターン一覧

| パターンID | 名前 | 用途 |
|-----------|------|------|
| `field_show_hide` | フィールド表示/非表示 | 条件に応じてフィールドを表示/非表示 |
| `field_disable` | フィールド編集不可 | 条件に応じてフィールドを編集不可 |
| `condition_status` | ステータス分岐 | ステータス値に応じた複合処理 |
| `style_section_header` | セクション見出し | スペーサーに見出しを追加 |
| `validate_required` | 条件付き必須チェック | 条件に応じて必須チェック |

## コード生成

### 1. テンプレート読み込み

```
templates/customize/patterns/{pattern_id}.js
templates/customize/styles/{style_id}.css
```

### 2. パラメータ埋め込み

テンプレート内の `{{PARAMETER_NAME}}` を実際の値で置換。

**例**:
```javascript
// Before
var TRIGGER_FIELD = '{{TRIGGER_FIELD}}';
var TARGET_FIELDS = {{TARGET_FIELDS}};

// After
var TRIGGER_FIELD = 'ステータス';
var TARGET_FIELDS = ['備考', '担当者'];
```

### 3. 複数パターンの合成

複数のパターンを1つのファイルに合成。

**合成テンプレート**:
```javascript
(function() {
  'use strict';

  // ========================================
  // パターン1: {PATTERN_1_NAME}
  // ========================================
  {PATTERN_1_CODE}

  // ========================================
  // パターン2: {PATTERN_2_NAME}
  // ========================================
  {PATTERN_2_CODE}

})();
```

### 4. ファイル出力

```
outputs/${Project}/
├── customize_${AppName}.js
└── customize_${AppName}.css  # スタイルパターン使用時のみ
```

## kintoneへの適用（Bashツールで直接実行）

**すべてのAPI呼び出しはBashツールでcurlを直接実行する。シェルスクリプト（.shファイル）は使用しない。**

### 1. ファイルアップロード

```bash
# Bashツールで直接実行
RESPONSE=$(curl -s -X POST "${KINTONE_DOMAIN}/k/v1/file.json" \
  -H "${AUTH_HEADER}" \
  -F "file=@outputs/プロジェクト名/customize_アプリ名.js")

FILE_KEY=$(echo "$RESPONSE" | jq -r '.fileKey')
echo "FileKey: $FILE_KEY"
```

**レスポンス**: `{"fileKey": "xxxx-xxxx-xxxx"}`

### 2. カスタマイズ設定

```bash
# Bashツールで直接実行
curl -s -X PUT "${KINTONE_DOMAIN}/k/v1/preview/app/customize.json" \
  -H "${AUTH_HEADER}" \
  -H "Content-Type: application/json" \
  -d "{
    \"app\": \"${APP_ID}\",
    \"desktop\": {
      \"js\": [{\"type\": \"FILE\", \"file\": {\"fileKey\": \"${FILE_KEY}\"}}],
      \"css\": []
    }
  }"
```

### 3. アプリデプロイ

```bash
# Bashツールで直接実行
curl -s -X POST "${KINTONE_DOMAIN}/k/v1/preview/app/deploy.json" \
  -H "${AUTH_HEADER}" \
  -H "Content-Type: application/json" \
  -d "{\"apps\": [{\"app\": \"${APP_ID}\"}]}"
```

### 4. デプロイ完了待機

```bash
# Bashツールで直接実行（ポーリング）
sleep 2
curl -s -X GET "${KINTONE_DOMAIN}/k/v1/preview/app/deploy.json?apps=${APP_ID}" \
  -H "${AUTH_HEADER}" | jq '.apps[0].status'
# "SUCCESS" になるまで繰り返し
```

## 処理フロー

```
1. 入力情報の収集
   ├── アプリIDの取得
   ├── フィールド設計書の読み込み
   └── カスタマイズ要件の抽出

2. 既存カスタマイズの確認
   ├── 存在する → 警告表示してスキップ
   └── 存在しない → 続行

3. パターンマッチング
   ├── カタログ読み込み
   ├── 要件を解析
   └── 適切なパターンを選択

4. コード生成
   ├── テンプレート読み込み
   ├── パラメータ埋め込み
   └── 複数パターン合成

5. kintoneに適用
   ├── ファイルアップロード
   ├── カスタマイズ設定
   └── デプロイ

6. 結果レポート
```

## 出力

### 生成ファイル

```
outputs/${Project}/
├── customize_${AppName}.js
└── customize_${AppName}.css  # スタイルパターン使用時
```

### 完了レポート

```markdown
## カスタマイズ適用結果

### 対象アプリ
| アプリ名 | アプリID | 適用パターン | 状態 |
|---------|---------|--------------|------|
| 顧客管理 | 123 | field_disable, style_section_header | ✅ 成功 |
| 受注管理 | 124 | - | ⏭️ スキップ（既存カスタマイズあり） |

### 生成ファイル
- `outputs/顧客管理システム/customize_顧客管理.js`
- `outputs/顧客管理システム/customize_顧客管理.css`

### 適用されたカスタマイズ
#### 顧客管理アプリ
1. **フィールド編集不可制御**
   - トリガー: ステータス = "完了"
   - 対象: 備考フィールド

2. **セクション見出し**
   - 基本情報セクション
   - 連絡先情報セクション
```

## エラーハンドリング

### パターンマッチング失敗

```
要件に対応するパターンが見つかりません:
「金額が10万円以上の時、承認者フィールドを表示したい」

→ 数値条件のパターンは現在未対応です。
→ カスタム開発が必要な場合は、手動でJavaScriptを作成してください。
```

### REST APIエラー

| ステータス | 原因 | 対処 |
|-----------|------|------|
| 401 | 認証エラー | 認証情報を確認 |
| 403 | 権限不足 | アプリ管理権限を確認 |
| 404 | アプリが見つからない | アプリIDを確認 |

### ファイルアップロードエラー

```
ファイルアップロードに失敗しました。
→ ファイルサイズ制限（10MB）を超えていないか確認してください。
→ ネットワーク接続を確認してください。
```

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

## 注意事項

1. **新規アプリのみ対応**: 既存のカスタマイズがあるアプリはスキップ
2. **パターン拡張**: 開発者のみパターン追加可能（ユーザーは追加不可）
3. **ロールバック**: 適用後の取り消しは手動で対応
4. **テスト推奨**: 本番環境適用前にテスト環境で確認
