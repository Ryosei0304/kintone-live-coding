---
name: kintone-mcp-setup
description: kintone MCPサーバーのセットアップを支援。接続確認から環境変数設定、トラブルシューティングまでガイド。
---

# kintone MCP サーバー セットアップ

kintone MCPサーバーのセットアップを対話形式で支援するスキルです。

## 概要

このスキルは以下を提供します：
- MCPサーバーの接続状態確認
- セットアップ手順のガイド
- 環境変数の設定支援
- トラブルシューティング

## セットアップ手順

### ステップ1: 現在の状態確認

まず、現在のMCPサーバー状態を確認します。

```bash
claude mcp list
```

**確認ポイント**:
- kintoneがリストに含まれているか
- 接続状態（Connected / Failed）

### ステップ2: MCPサーバーの追加

kintone MCPサーバーがリストにない場合、追加します。

```bash
# 公式kintone MCPサーバーを追加
claude mcp add kintone -- npx -y @anthropic-ai/kintone-mcp-server

# または cybozu公式版
claude mcp add kintone -- npx -y @kintone/mcp-server
```

**注意**: パッケージ名は公式リポジトリで最新情報を確認してください。
- https://github.com/kintone/mcp-server

### ステップ3: 環境変数の設定

kintone接続に必要な環境変数を設定します。

#### 認証方法1: ユーザー名/パスワード

```bash
export KINTONE_DOMAIN=https://your-domain.cybozu.com
export KINTONE_USERNAME=your-username
export KINTONE_PASSWORD=your-password
```

#### 認証方法2: APIトークン

```bash
export KINTONE_DOMAIN=https://your-domain.cybozu.com
export KINTONE_API_TOKEN=your-api-token
```

**永続化する場合**:
- `~/.bashrc` または `~/.zshrc` に追記
- または `.env` ファイルを使用

### ステップ4: Claude Codeの再起動（重要！）

**CRITICAL**: MCPサーバーを追加した後は、**必ずClaude Codeを再起動**してください。

```bash
# Claude Codeを終了
exit

# 再度起動
claude
```

**なぜ再起動が必要？**
- MCPサーバーのツールはClaude Code起動時にロードされる
- 追加後に再起動しないと、ツールが利用可能にならない

### ステップ5: 接続確認

再起動後、接続を確認します。

```bash
claude mcp list
```

期待する出力:
```
kintone: ... - ✓ Connected
```

さらに、アプリ一覧を取得して動作確認:
```
kintone-get-apps ツールを実行
```

## トラブルシューティング

### 問題1: "kintone tools not found"

**原因**:
- MCPサーバーが追加されていない
- Claude Codeを再起動していない

**対処**:
1. `claude mcp list` で確認
2. リストにない場合は追加
3. **Claude Codeを再起動**

### 問題2: "Failed to connect"

**原因**:
- 環境変数が設定されていない
- 認証情報が間違っている
- ネットワーク問題

**対処**:
1. 環境変数を確認: `echo $KINTONE_DOMAIN`
2. kintoneにブラウザでログインできるか確認
3. 認証情報を再設定

### 問題3: "指定したアプリが見つかりません"

**原因**:
- ルックアップ/関連レコード一覧の参照先アプリがデプロイされていない

**対処**:
- 参照先アプリを先にデプロイする
- デプロイ順序: マスタ → デプロイ → トランザクション → デプロイ

### 問題4: "権限がありません"

**原因**:
- kintoneユーザーにアプリ作成権限がない

**対処**:
- kintone管理者に権限付与を依頼

## 確認チェックリスト

セットアップ完了時に確認:

- [ ] `claude mcp list` でkintoneが `✓ Connected`
- [ ] `kintone-get-apps` でアプリ一覧が取得できる
- [ ] 環境変数が正しく設定されている

## 次のステップ

セットアップ完了後:
1. `/kintone-workflow` でアプリ作成ワークフローを開始
2. または `kintone-deployer` エージェントを直接使用

## 関連リソース

- kintone MCP サーバー: https://github.com/kintone/mcp-server
- kintone API ドキュメント: https://kintone.dev/
