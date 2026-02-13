# kintone ワークフロー 詳細リファレンス

SKILL.md の補足情報。オーケストレーター（メインエージェント）が直接実行する処理の詳細を記載。

---

## チェックポイント詳細

### Checkpoint ①（Phase 1 → Phase 2）

**表示内容**:
- コンテキスト整理書のサマリ
- ゴール・優先度テーブル
- スコープ（対象/対象外）テーブル
- アクターテーブル
- 「Phase 2に進んでよろしいですか？」と確認

**サマリ生成方法**:
1. `コンテキスト整理_*.md` をReadで取得
2. アクター一覧、ペインポイント、ゴール、スコープを抽出して表示

### Checkpoint ②（Phase 2 → Phase 3）

**コンセプト**: 図で合意形成する。To-Beフロー図をdraw.ioに表示し、図をベースに確認・修正。

**表示フロー**:
1. `業務フロー設計_*.md` からTo-Be業務フロー図のMermaidブロックを抽出
2. `open_drawio_mermaid` で draw.io にフロー図を表示（デフォルト動作）
3. 「draw.ioにフロー図を表示しました」とユーザーに伝える
4. 補足情報をテーブルで表示:
   - ビジネスイベント一覧テーブル（「これらがアプリの元になります」と説明）
   - MVPスコープテーブル
   - カスタマイズ要件サマリテーブル

※ drawio MCPが利用不可の場合はMarkdown上のMermaidテキストで代替

**修正フロー**（どちらの方法も受け付ける。混在もOK）:
```
open_drawio_mermaid でフロー図を表示
  → ユーザーが draw.io で目視確認
  → 修正なし: そのまま Phase 3 へ
  → 修正あり（以下どちらも受け付け）:
      ・自然言語で伝える → エージェントが Mermaid を更新
      ・draw.ioで直接編集 → drawio-diff（generic モード）で差分検出 → 設計書に反映
      → 図を再表示 → Checkpoint ② に戻る
```

**サマリ生成方法**:
1. `業務フロー設計_*.md` をReadで取得
2. To-Beフロー図のMermaidブロックを抽出
3. ビジネスイベント、MVPスコープ、カスタマイズ要件をテーブル形式で表示

### Checkpoint ③（Phase 3 → Phase 4）

**コンセプト**: ER図で合意形成する。アプリ間の関係を視覚的に確認し、構造を固める。

**表示フロー**:
1. `アプリアーキテクチャ_*.md` からER図のMermaidブロックを抽出
2. `open_drawio_mermaid` で draw.io にER図を表示（デフォルト動作）
3. 「draw.ioにER図を表示しました」とユーザーに伝える
4. 補足情報をテーブルで表示:
   - アプリ一覧テーブル
   - ユースケース × アプリ マッピング
   - カスタマイズ要件マッピングテーブル

※ drawio MCPが利用不可の場合はMarkdown上のMermaidテキストで代替

**修正フロー**（どちらの方法も受け付ける。混在もOK）:
```
open_drawio_mermaid でER図を表示
  → ユーザーが draw.io で目視確認
  → 修正なし: そのまま Phase 4 へ
  → 修正あり（以下どちらも受け付け）:
      ・自然言語で伝える → エージェントが Mermaid を更新
      ・draw.ioで直接編集 → drawio-diff（er モード）で差分検出 → アーキテクチャ書を更新
      → 図を再表示 → Checkpoint ③ に戻る
```

**サマリ生成方法**:
1. `アプリアーキテクチャ_*.md` をReadで取得
2. ER図のMermaidブロック、アプリ一覧テーブル、マッピングテーブルを抽出して表示

### Checkpoint ④（Phase 4 → Phase 5）

**チェック項目**:
- 不足リストの有無（設計書末尾に記載される場合がある）
- 統合レビューのCRITICAL件数（0件であること）
- アプリ一覧とフィールド数
- アプリ間連携（ルックアップ、関連レコード）
- カスタマイズ要件の有無

**表示内容**:
- 統合マッピングテーブル（業務タスク × アプリ × 画面操作 × データフロー）
- ギャップ・矛盾チェック結果
- デプロイ計画（2-Pass方式）

**環境・スペース設定**:
- kintoneドメイン・認証情報の確認（Pre-flight Check）
- 「アプリを既存のスペースに作成しますか？」と質問
  - はい → スペースIDを入力
  - いいえ → ポータル直下にデプロイ

**デプロイ計画の表示**:
```markdown
## デプロイ計画

### 作成アプリ一覧
| No | アプリ名 | フィールド数 | プロセス管理 |
|----|----------|--------------|--------------|

### 対象環境
- ドメイン: xxx.cybozu.com
- デプロイ先: 既存スペース（ID: xxx） / ポータル直下

### デプロイ順序（2パス方式）
#### Pass 1: 基本フィールド
1. 全アプリ作成 → 2. 基本フィールド追加 → 3. デプロイ

#### Pass 2: 連携フィールド（優先度順）
1. ルックアップ/関連レコード追加 → 2. レイアウト調整 → 3. デプロイ
```

---

## 完了レポート形式

`deployment_result_${Date}.json` から生成する:

```markdown
## デプロイ完了レポート

### スペース情報
- スペースURL: https://xxx.cybozu.com/k/#/space/${SpaceID}

### 作成したアプリ
| No | アプリ名 | アプリID | URL | フィールド数 |
|----|----------|----------|-----|--------------|

### アプリ間連携
| 参照元 | 参照先 | 連携種別 | 状態 |
|--------|--------|----------|------|

### カスタマイズ適用結果
| アプリ名 | 適用パターン | 状態 |
|----------|--------------|------|

### テストデータ投入結果
| アプリ名 | 投入件数 | 状態 |
|----------|----------|------|
```

---

## フィードバックループ詳細

### フィードバック収集フロー

1. 完了レポート表示後、AskUserQuestionでフィードバックを収集
2. フィードバックの内容を分析し、影響フェーズを判定
3. `フィードバック_${Project}_${Date}_${連番}.md` を生成
4. 該当フェーズに戻って再実行

### 影響フェーズ判定基準

| フィードバック内容 | 影響フェーズ | 戻り先 |
|------------------|------------|--------|
| 業務フロー自体が違う | Phase 2 | 業務フロー設計から |
| アプリを追加/削除したい | Phase 3 | アプリアーキテクチャから |
| フィールドを追加/変更したい | Phase 4 | 詳細設計から |
| カスタマイズを変更したい | Phase 5b | カスタマイズのみ再実行 |
| テストデータを変えたい | Phase 5c | テストデータのみ再実行 |

### 連番管理

- 初回: `フィードバック_${Project}_${Date}_01.md`
- 2回目: `フィードバック_${Project}_${Date}_02.md`
- 既存のフィードバックファイルをGlobで確認し、連番をインクリメント

---

## deployment_result.json スキーマ

Phase 5aで生成、Phase 5b・5cで追記更新される構造化データ:

```json
{
  "project": "プロジェクト名",
  "date": "YYYYMMDD",
  "domain": "https://xxx.cybozu.com",
  "spaceId": 123,
  "apps": [
    {
      "name": "アプリ名",
      "appId": "123",
      "url": "https://xxx.cybozu.com/k/123/",
      "type": "master | transaction",
      "fieldCount": 10,
      "deployStatus": "SUCCESS | FAIL"
    }
  ],
  "relationships": [
    {
      "sourceApp": "参照元アプリ名",
      "targetApp": "参照先アプリ名",
      "type": "lookup | reference_table",
      "status": "SUCCESS | FAIL"
    }
  ],
  "customizations": [
    {
      "appName": "アプリ名",
      "appId": "123",
      "patterns": ["field_disable", "style_section_header"],
      "fileName": "customize_アプリ名.js",
      "status": "SUCCESS | SKIP | FAIL"
    }
  ],
  "testData": [
    {
      "appName": "アプリ名",
      "appId": "123",
      "count": 3,
      "status": "SUCCESS | FAIL"
    }
  ],
  "errors": []
}
```

---

## エラー処理

### サブエージェントエラー

サブエージェントが予期せず終了した場合:
1. エラー内容をユーザーに簡潔に表示
2. 再試行 or 中断を確認（AskUserQuestion）

### API エラー

- 認証エラー: 「kintoneへの接続に失敗しました。`.env` の認証情報を確認してください」
- タイムアウト: 「処理がタイムアウトしました。再試行してください」

### 循環参照エラー

- 循環参照: 「循環参照が検出されました。設計書を修正してください」

### テストデータ投入エラー

- 投入失敗: 処理を継続（成功分は保持）、警告表示のみ

---

## draw.io MCP 連携

### 概要

drawio MCP サーバー（`@drawio/mcp`）が利用可能な場合、Checkpoint ②③ でMermaid図をdraw.ioエディタに表示し、ユーザーが目視確認・手動修正できる。

### 利用可能なツール

| ツール | 用途 | パラメータ |
|--------|------|-----------|
| `open_drawio_mermaid` | Mermaid図をdraw.ioで表示 | `content`: Mermaid構文 |
| `open_drawio_xml` | draw.io XMLを直接表示 | `content`: XML |
| `open_drawio_csv` | CSVからフローチャート生成 | `content`: CSV |

### ワークフローでの使用箇所

| Checkpoint | 表示する図 | ツール |
|-----------|-----------|--------|
| ② | To-Be業務フロー図 | `open_drawio_mermaid` |
| ③ | ER図（erDiagram） | `open_drawio_mermaid` |

### 修正フロー

1. Mermaid図を `open_drawio_mermaid` で draw.io に表示
2. ユーザーが draw.io 上で目視確認
3. 修正がある場合:
   - ユーザーが**自然言語で修正内容を伝える**（例: 「顧客マスタと商品マスタの間に関連レコードを追加して」）
   - エージェントがMermaidソースを更新
   - `open_drawio_mermaid` で再表示して確認
4. 修正なし: そのまま次のPhaseへ

### draw.io Pull 機構（Playwright MCP 連携）

drawio MCPは**push only**（Mermaid → draw.io表示）だが、Playwright MCPを組み合わせることでdraw.ioから**データをpull**できる。これにより、ユーザーがdraw.io上で直接修正した内容をエージェントが読み取れる。

**前提条件**: Playwright MCP が利用可能であること

**技術概要**:
- draw.ioはmxGraphライブラリを使用。EditorUiインスタンスはグローバルに公開されていない
- `mxGraph.prototype.getModel` をhookし、DOMイベント（mousemove）でトリガーしてインスタンスを取得
- `mxCodec` でモデルをXMLにエンコードし、パースして構造化データを抽出
- スクリプト: `scripts/drawio-pull.js` に4つの抽出関数を格納

**利用可能な抽出モード**:

| モード | 関数名 | 返却データ |
|--------|--------|-----------|
| Raw XML | `EXTRACT_RAW_XML` | mxGraphModel XML全文 |
| ER図パース | `EXTRACT_ER_DIAGRAM` | テーブル/フィールド/エッジ構造化JSON |
| 汎用シェイプ | `EXTRACT_ALL_SHAPES` | 全シェイプ+接続のJSON |
| Mermaid復元 | `EXTRACT_AS_MERMAID` | Mermaid erDiagramソースコード |

**Pull付き修正フロー**:
```
Mermaid図生成 → open_drawio_mermaid で表示
  → ユーザーが draw.io で直接テーブル/フィールドを編集
  → Playwright browser_evaluate で EXTRACT_ER_DIAGRAM を実行
  → 変更差分を検出（テーブル追加/削除、フィールド変更など）
  → 設計書を自動更新
  → 確認OK → 次のPhaseへ
```

**使用例**（Checkpoint ③でER図を修正する場合）:
1. `open_drawio_mermaid` でER図をdraw.ioに表示
2. ユーザーがdraw.io上でテーブルやフィールドを追加・削除・変更
3. ユーザーが「修正したよ」と伝える
4. Playwright `browser_evaluate` で `EXTRACT_ER_DIAGRAM` を実行
5. 取得したJSON構造と元のアーキテクチャ文書を比較
6. 差分を反映して `アプリアーキテクチャ_*.md` を更新
7. `open_drawio_mermaid` で更新後のER図を再表示して確認

### drawio MCPが利用不可の場合

MCPが設定されていない場合は、従来通りMarkdown上のMermaidテキストで確認する（フォールバック）。draw.io表示はオプション機能であり、ワークフローの必須要件ではない。

### セットアップ

```bash
# draw.io MCP（push: Mermaid → draw.io表示）
claude mcp add drawio -- npx @drawio/mcp

# Playwright MCP（pull: draw.io → 構造化データ抽出）※オプション
claude mcp add playwright -- npx @anthropic/mcp-playwright
```

設定後、Claude Codeを再起動してツールを読み込む。

---

## 技術用語の説明ポリシー

技術用語は括弧書きで補足説明を入れる：
- ルックアップ（他のアプリから情報を自動取得する機能）
- プロセス管理（承認フローなどのステータス管理機能）
- 関連レコード一覧（関連するデータを一覧表示する機能）
- デプロイ優先度（参照先→参照元の順でフィールドを作成する仕組み）
- ビジネスイベント（業務の中でデータが生まれるタイミング）
- ER図（アプリ間の関係を視覚化した図）
