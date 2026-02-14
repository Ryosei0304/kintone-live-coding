---
name: kintone-app-update
description: 既存kintoneアプリへの変更適用手順。5-Passアップデートデプロイで安全にフィールド・関係・プロセス管理・レイアウト・ビュー変更を適用する。
disable-model-invocation: true
---

# Phase R4: 変更適用

設計書に基づき、既存kintoneアプリに変更を適用する5-Passアップデートデプロイ手順書。

## 概要

| 項目 | 内容 |
|------|------|
| インプット | `アプリ設計書_*.md`, `フィールド設計書_*.md`, `変更計画_*.md` |
| アウトプット | `deployment_result_${Date}.json` |
| 実行エージェント | `kintone-updater`（メイン）, `kintone-customizer`（カスタマイズ変更時のみ） |

## 前提条件

- Pre-flight Check 完了済み
- 設計書が統合レビュー（Checkpoint R3）を通過済み
- 変更計画書の5-Pass適用順序が確定済み

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

## Pass U3: プロセス管理更新

### プロセス管理更新

```bash
PUT /k/v1/preview/app/status.json
Body: {"app": "${APP_ID}", "enable": true, "states": {...}, "actions": {...}}
```

### 完了後

全対象アプリをデプロイ:
```bash
POST /k/v1/preview/app/deploy.json
```

### 進捗表示

```
[Pass U3] プロセス管理更新
  受注管理: プロセス管理更新 ... OK
  デプロイ: 完了
```

## Pass U4: レイアウト最適化

フィールド設計書のレイアウト設計に基づき、フォームレイアウトを最適化する。
`/start` の Phase 3（レイアウト調整）と同等の詳細ガイドに従って配置する。

### レイアウト更新API

```bash
PUT /k/v1/preview/app/form/layout.json
Body: {"app": "${APP_ID}", "layout": [...]}
```

### 横並びにすべきフィールドパターン

| パターン | フィールド例 | 1行あたり |
|----------|-------------|----------|
| **ペア項目** | 開始日 + 終了日 | 2個 |
| **名前** | 姓 + 名 | 2個 |
| **住所** | 都道府県 + 市区町村 + 番地 | 2-3個 |
| **金額** | 単価 + 数量 + 小計 | 3個 |
| **連絡先** | 電話 + メール | 2個 |
| **ルックアップ後** | 自動コピーされるフィールド群 | 2-3個 |
| **短いフィールド** | ステータス + 優先度 | 2-3個 |

### 横並びにしないフィールド（1行1個）

- 複数行テキスト（MULTI_LINE_TEXT）
- リッチエディタ（RICH_TEXT）
- テーブル（SUBTABLE）
- 関連レコード一覧（REFERENCE_TABLE）
- 長い選択肢のドロップダウン

### 幅の設定ガイド

| フィールド数/行 | 各フィールド幅目安 |
|----------------|-------------------|
| 2フィールド | 各250-350px |
| 3フィールド | 各150-200px |
| 4フィールド | 各120-150px |

### スペーサーフィールドの配置

スペーサーはレイアウトAPIで配置し、`style_section_header` カスタマイズで見出しスタイルを適用する。

```json
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

### ラベルフィールドの配置

ラベルはフォームレイアウトAPIで直接配置する（フィールド追加APIは不要）。

```json
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

### 完了後

全対象アプリをデプロイ:
```bash
POST /k/v1/preview/app/deploy.json
```

### 進捗表示

```
[Pass U4] レイアウト最適化
  顧客マスタ: レイアウト更新 ... OK
  受注管理: レイアウト更新 ... OK
  活動履歴: レイアウト設定 ... OK
  デプロイ: 完了
```

## Pass U5: ビュー更新

フィールド設計書のビュー設計セクションに基づき、ビューを作成・更新する。

### ビュー作成API

```bash
PUT /k/v1/preview/app/views.json
Body: {"app": "${APP_ID}", "views": {...}}
```

### LIST ビュー

```json
{
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
}
```

### CALENDAR ビュー

```json
{
  "views": {
    "スケジュール": {
      "index": "2",
      "type": "CALENDAR",
      "name": "スケジュール",
      "date": "due_date",
      "title": "task_name",
      "sort": "更新日時 desc"
    }
  }
}
```

### ビュー設計の参照元

- フィールド設計書の「ビュー設計」セクションに定義されたビューを作成する
- 変更計画で新規追加・変更が指定されたビューのみ適用する

### 最終デプロイ

全対象アプリをデプロイ:
```bash
POST /k/v1/preview/app/deploy.json
```

### 進捗表示

```
[Pass U5] ビュー更新
  受注管理: ビュー追加 (進捗ビュー) ... OK
  活動履歴: ビュー追加 (最新活動) ... OK
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
        {"pass": "U3", "type": "UPDATE_PROCESS", "status": "SUCCESS"},
        {"pass": "U4", "type": "UPDATE_LAYOUT", "status": "SUCCESS"},
        {"pass": "U5", "type": "UPDATE_VIEW", "view": "未対応のみ", "status": "SUCCESS"}
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
4. **カスタマイズは別ステップ**: カスタマイズ適用は `kintone-customizer` が担当（R4cで実行）
