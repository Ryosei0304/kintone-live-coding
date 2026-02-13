---
name: kintone-app-update
description: 既存kintoneアプリへの変更適用手順。3-Passアップデートデプロイで安全にフィールド・関係・レイアウト変更を適用する。
---

# Phase R4: 変更適用

設計書に基づき、既存kintoneアプリに変更を適用する3-Passアップデートデプロイ手順書。

## 概要

| 項目 | 内容 |
|------|------|
| インプット | `アプリ設計書_*.md`, `フィールド設計書_*.md`, `変更計画_*.md` |
| アウトプット | `deployment_result_${Date}.json` |
| 実行エージェント | `kintone-updater`（メイン）, `kintone-customizer`（カスタマイズ変更時のみ） |

## 前提条件

- Pre-flight Check 完了済み
- 設計書が統合レビュー（Checkpoint R3）を通過済み
- 変更計画書の3-Pass適用順序が確定済み

## Pass U1: 基本フィールド変更

ルックアップ/関連レコード以外のフィールド操作を実行する。

### 実行順序

1. **DELETE**: フィールド削除（依存を先に除去）
2. **MODIFY**: フィールド変更
3. **ADD**: フィールド追加（`unique: true` を含む場合は Pass 2 のルックアップ前に設定）

### API

```bash
# フィールド追加
POST /k/v1/preview/app/form/fields.json
Body: {"app": "${APP_ID}", "properties": {"field_code": {...}}}

# フィールド変更
PUT /k/v1/preview/app/form/fields.json
Body: {"app": "${APP_ID}", "properties": {"field_code": {...}}}

# フィールド削除
DELETE /k/v1/preview/app/form/fields.json
Body: {"app": "${APP_ID}", "fields": ["field_code_1", "field_code_2"]}
```

### 完了後

全対象アプリをデプロイ:
```bash
POST /k/v1/preview/app/deploy.json
Body: {"apps": [{"app": "${APP_ID_1}"}, {"app": "${APP_ID_2}"}]}
```

デプロイ完了をポーリングで確認。

### 進捗表示

```
[Pass U1] 基本フィールド変更
  顧客マスタ (DELETE): phone_old ... OK
  顧客マスタ (ADD): email, phone_new ... OK
  受注管理 (MODIFY): status ... OK
  デプロイ: 完了
```

## Pass U2: 新規アプリ + 関係変更（依存順）

### Step U2-1: 新規アプリ作成（ある場合）

```bash
# 1. アプリ作成
POST /k/v1/preview/app.json
Body: {"name": "${APP_NAME}", "space": "${SPACE_ID}"}

# 2. 基本フィールド追加（ルックアップ以外）
POST /k/v1/preview/app/form/fields.json

# 3. デプロイ
POST /k/v1/preview/app/deploy.json
```

新規アプリ作成の詳細は `.claude/skills/kintone-app-creation/SKILL.md` を参照。

### Step U2-2: ルックアップ/関連レコード変更（依存順）

依存順序に従い、1つずつ追加 → デプロイ:

```
1. マスタアプリのルックアップ先に新規アプリのフィールドが必要
   → 新規アプリを先にデプロイ
2. 参照先 → 参照元の順でルックアップ追加
   → 各追加後にデプロイ（次のルックアップが参照する可能性）
```

### ルックアップ追加時の注意

- 参照先フィールドに `unique: true` が設定済みか確認
- 未設定の場合は Pass U1 で設定済みのはず（設計書で確認）
- 参照先アプリがデプロイ済みか確認

### 進捗表示

```
[Pass U2] 新規アプリ + 関係変更
  新規アプリ作成: 活動履歴 (ID: 456) ... OK
  デプロイ: 完了
  ルックアップ追加: 受注管理 → 顧客マスタ ... OK
  ルックアップ追加: 活動履歴 → 顧客マスタ ... OK
  デプロイ: 完了
```

## Pass U3: レイアウト・ビュー・プロセス管理・カスタマイズ

### レイアウト更新

```bash
PUT /k/v1/preview/app/form/layout.json
Body: {"app": "${APP_ID}", "layout": [...]}
```

レイアウトの設計パターンは `kintone-app-creation` スキルの「Phase 3: レイアウト調整」を参照。

### ビュー更新

```bash
PUT /k/v1/preview/app/views.json
Body: {"app": "${APP_ID}", "views": {...}}
```

### プロセス管理更新

```bash
PUT /k/v1/preview/app/status.json
Body: {"app": "${APP_ID}", "enable": true, "states": {...}, "actions": {...}}
```

### カスタマイズ更新

**重要: 既存カスタマイズの保持**

1. 既存カスタマイズを取得:
   ```bash
   GET /k/v1/app/customize.json?app=${APP_ID}
   ```

2. 変更計画で言及されていないファイルは `fileKey` をそのまま保持

3. 新規カスタマイズのみ追加:
   ```bash
   # ファイルアップロード
   POST /k/v1/file.json
   Body: multipart/form-data (file)

   # カスタマイズ更新（既存 + 新規）
   PUT /k/v1/preview/app/customize.json
   Body: {"app": "${APP_ID}", "desktop": {"js": [既存fileKeys + 新規fileKey]}}
   ```

### 最終デプロイ

全対象アプリをデプロイ:
```bash
POST /k/v1/preview/app/deploy.json
```

### 進捗表示

```
[Pass U3] レイアウト・ビュー・プロセス管理・カスタマイズ
  顧客マスタ: レイアウト更新 ... OK
  受注管理: レイアウト更新 ... OK
  受注管理: ビュー追加 (進捗ビュー) ... OK
  活動履歴: レイアウト設定 ... OK
  最終デプロイ: 完了
```

## Deployment Result JSON

```json
{
  "project": "${Project}",
  "mode": "restart",
  "deploymentDate": "${Date}",
  "spaceId": "${SpaceId}",
  "existingApps": [
    {
      "appId": 123,
      "appName": "顧客マスタ",
      "url": "https://xxx.cybozu.com/k/123/",
      "changes": [
        {"pass": "U1", "type": "ADD_FIELD", "field": "email", "status": "SUCCESS"},
        {"pass": "U1", "type": "DELETE_FIELD", "field": "phone_old", "status": "SUCCESS"},
        {"pass": "U3", "type": "UPDATE_LAYOUT", "status": "SUCCESS"}
      ]
    }
  ],
  "newApps": [
    {
      "appId": 456,
      "appName": "活動履歴",
      "url": "https://xxx.cybozu.com/k/456/",
      "fields": 10,
      "status": "SUCCESS"
    }
  ],
  "customizations": [],
  "errors": []
}
```

## エラーハンドリング

### 失敗時の対応

1. エラー情報を `errors` 配列に記録
2. **以降のPassを中断**
3. 部分成功状態をレポート
4. ユーザーに状況を報告

### 部分成功からの再実行

変更計画書の成功済み項目をスキップし、未完了分のみ再実行:
1. `deployment_result.json` の `changes` を確認
2. `status: "SUCCESS"` の操作はスキップ
3. `status: "FAILED"` または未記録の操作から再開

## 注意事項

1. **各Pass完了後に即時記録**: `deployment_result.json` は逐次更新
2. **デプロイは非同期**: ポーリングで完了を待つ
3. **ロールバックなし**: kintoneにアトミックトランザクション非対応のため自動ロールバックは行わない
4. **カスタマイズ保持**: 変更計画外のJS/CSSは絶対に上書きしない
