---
name: drawio-diff
description: draw.ioで編集された図と設計書の差分を検出。Playwright MCP経由でER図のテーブル/フィールド/リレーション変更を抽出し、設計書を自動更新。
---

# draw.io 図面差分検出

draw.ioエディタ上でユーザーが編集した図の変更を検出し、設計書に反映するスキル。Playwright MCPを使用してブラウザ上のdraw.ioからmxGraphモデルを読み取り、元の設計との差分を特定する。

## 前提条件

- Playwright MCP が利用可能であること
- draw.io がブラウザで開かれていること（`open_drawio_mermaid` 等で表示済み）

## 利用シーン

| シーン | 使用モード |
|--------|-----------|
| Checkpoint ②: ユーザーがTo-Beフロー図を編集した | `generic` |
| Checkpoint ③: ユーザーがER図を編集した | `er` |
| 修正内容の差分検出 | `er` → 元の設計と比較 |
| Mermaidソースの再生成 | `mermaid` |

## 実行手順

### Step 1: ブラウザ状態確認

Playwright の `browser_snapshot` でdraw.ioが開かれていることを確認。

```
browser_snapshot で現在のページを確認
→ Page Title に "draw.io" が含まれていれば OK
→ 含まれていなければ「draw.ioが開かれていません」と報告して終了
```

### Step 2: データ抽出（モード選択）

#### モード: `er`（ER図）

ER図のテーブル・フィールド・エッジを構造化JSONで取得。Checkpoint ③ での差分検出に使用。

Playwright `browser_evaluate` で以下を実行:

```javascript
() => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject('Timeout'), 5000);
    const origGetModel = mxGraph.prototype.getModel;
    mxGraph.prototype.getModel = function() {
      mxGraph.prototype.getModel = origGetModel;
      clearTimeout(timeout);
      const model = origGetModel.call(this);
      const codec = new mxCodec();
      const node = codec.encode(model);
      const xml = mxUtils.getXml(node);
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');
      const cells = doc.querySelectorAll('mxCell');
      const childrenOf = {};
      const cellMap = {};
      cells.forEach(cell => {
        const id = cell.getAttribute('id');
        const parent = cell.getAttribute('parent');
        cellMap[id] = cell;
        if (parent) {
          if (!childrenOf[parent]) childrenOf[parent] = [];
          childrenOf[parent].push(cell);
        }
      });
      const tables = [];
      cells.forEach(cell => {
        const style = cell.getAttribute('style') || '';
        if (style.includes('shape=table') && !style.includes('shape=tableRow')) {
          const tableId = cell.getAttribute('id');
          const tableName = (cell.getAttribute('value') || '').replace(/<[^>]*>/g, '').trim();
          const rowContainers = childrenOf[tableId] || [];
          const fields = [];
          rowContainers.forEach(rowCell => {
            const rowId = rowCell.getAttribute('id');
            const rowChildren = childrenOf[rowId] || [];
            const vals = rowChildren.map(c => (c.getAttribute('value') || '').replace(/<[^>]*>/g, '').trim());
            if (vals.length >= 2) {
              const f = { type: vals[0], name: vals[1] };
              if (vals[2]) f.constraint = vals[2];
              fields.push(f);
            }
          });
          tables.push({ name: tableName, fields });
        }
      });
      const tableIdMap = {};
      cells.forEach(cell => {
        const style = cell.getAttribute('style') || '';
        if (style.includes('shape=table') && !style.includes('shape=tableRow')) {
          tableIdMap[cell.getAttribute('id')] = (cell.getAttribute('value') || '').replace(/<[^>]*>/g, '').trim();
        }
      });
      const edges = [];
      cells.forEach(cell => {
        const source = cell.getAttribute('source');
        const target = cell.getAttribute('target');
        if (source && target) {
          const label = (cell.getAttribute('value') || '').replace(/<[^>]*>/g, '').trim();
          let from = tableIdMap[source];
          let to = tableIdMap[target];
          if (!from) from = tableIdMap[cellMap[source]?.getAttribute('parent')] || source;
          if (!to) to = tableIdMap[cellMap[target]?.getAttribute('parent')] || target;
          edges.push({ from, to, type: label || 'relates' });
        }
      });
      resolve(JSON.stringify({ tables, edges }, null, 2));
      return model;
    };
    document.querySelector('.geDiagramContainer')
      .dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 100, clientY: 100 }));
  });
}
```

**返却データ形式**:
```json
{
  "tables": [
    {
      "name": "TABLE_NAME",
      "fields": [
        { "type": "string", "name": "field_name", "constraint": "PK" }
      ]
    }
  ],
  "edges": [
    { "from": "TABLE_A", "to": "TABLE_B", "type": "lookup" }
  ]
}
```

#### モード: `mermaid`（Mermaid ER図ソース復元）

draw.ioのER図からMermaid erDiagramソースコードを復元。

Playwright `browser_evaluate` で以下を実行:

```javascript
() => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject('Timeout'), 5000);
    const origGetModel = mxGraph.prototype.getModel;
    mxGraph.prototype.getModel = function() {
      mxGraph.prototype.getModel = origGetModel;
      clearTimeout(timeout);
      const model = origGetModel.call(this);
      const codec = new mxCodec();
      const node = codec.encode(model);
      const xml = mxUtils.getXml(node);
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');
      const cells = doc.querySelectorAll('mxCell');
      const childrenOf = {};
      const cellMap = {};
      cells.forEach(cell => {
        const id = cell.getAttribute('id');
        const parent = cell.getAttribute('parent');
        cellMap[id] = cell;
        if (parent) {
          if (!childrenOf[parent]) childrenOf[parent] = [];
          childrenOf[parent].push(cell);
        }
      });
      const tables = [];
      cells.forEach(cell => {
        const style = cell.getAttribute('style') || '';
        if (style.includes('shape=table') && !style.includes('shape=tableRow')) {
          const tableId = cell.getAttribute('id');
          const tableName = (cell.getAttribute('value') || '').replace(/<[^>]*>/g, '').trim();
          const rowContainers = childrenOf[tableId] || [];
          const fields = [];
          rowContainers.forEach(rowCell => {
            const rowId = rowCell.getAttribute('id');
            const rowChildren = childrenOf[rowId] || [];
            const vals = rowChildren.map(c => (c.getAttribute('value') || '').replace(/<[^>]*>/g, '').trim());
            if (vals.length >= 2) {
              const f = { type: vals[0], name: vals[1] };
              if (vals[2]) f.constraint = vals[2];
              fields.push(f);
            }
          });
          tables.push({ id: tableId, name: tableName, fields });
        }
      });
      const tableIdMap = {};
      tables.forEach(t => tableIdMap[t.id] = t.name);
      const edges = [];
      cells.forEach(cell => {
        const source = cell.getAttribute('source');
        const target = cell.getAttribute('target');
        if (source && target) {
          const label = (cell.getAttribute('value') || '').replace(/<[^>]*>/g, '').trim();
          const style = cell.getAttribute('style') || '';
          let from = tableIdMap[source];
          let to = tableIdMap[target];
          if (!from) from = tableIdMap[cellMap[source]?.getAttribute('parent')] || source;
          if (!to) to = tableIdMap[cellMap[target]?.getAttribute('parent')] || target;
          let rel = '||--o{';
          if (style.includes('ERmandOne') && style.includes('ERmandOne')) rel = '||--||';
          edges.push({ from, to, rel, label: label || '' });
        }
      });
      let mermaid = 'erDiagram\n';
      edges.forEach(e => {
        mermaid += '    ' + e.from + ' ' + e.rel + ' ' + e.to + ' : "' + e.label + '"\n';
      });
      mermaid += '\n';
      tables.forEach(t => {
        mermaid += '    ' + t.name + ' {\n';
        t.fields.forEach(f => {
          const c = f.constraint ? ' ' + f.constraint : '';
          mermaid += '        ' + f.type + ' ' + f.name + c + '\n';
        });
        mermaid += '    }\n\n';
      });
      resolve(mermaid);
      return model;
    };
    document.querySelector('.geDiagramContainer')
      .dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 100, clientY: 100 }));
  });
}
```

#### モード: `generic`（汎用シェイプ抽出）

フローチャートやシーケンス図など、ER図以外の図形を抽出。

Playwright `browser_evaluate` で以下を実行:

```javascript
() => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject('Timeout'), 5000);
    const origGetModel = mxGraph.prototype.getModel;
    mxGraph.prototype.getModel = function() {
      mxGraph.prototype.getModel = origGetModel;
      clearTimeout(timeout);
      const model = origGetModel.call(this);
      const codec = new mxCodec();
      const node = codec.encode(model);
      const xml = mxUtils.getXml(node);
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');
      const cells = doc.querySelectorAll('mxCell');
      const shapes = [];
      const connections = [];
      cells.forEach(cell => {
        const id = cell.getAttribute('id');
        const style = cell.getAttribute('style') || '';
        const value = cell.getAttribute('value') || '';
        const parent = cell.getAttribute('parent');
        const source = cell.getAttribute('source');
        const target = cell.getAttribute('target');
        if (source && target) {
          connections.push({ id, source, target, label: value.replace(/<[^>]*>/g, '').trim() });
        } else if (style && value) {
          const geo = cell.querySelector('mxGeometry');
          shapes.push({
            id, parent,
            value: value.replace(/<[^>]*>/g, '').trim(),
            style: style.substring(0, 80),
            x: geo?.getAttribute('x'), y: geo?.getAttribute('y'),
            width: geo?.getAttribute('width'), height: geo?.getAttribute('height')
          });
        }
      });
      resolve(JSON.stringify({ shapes, connections }, null, 2));
      return model;
    };
    document.querySelector('.geDiagramContainer')
      .dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 100, clientY: 100 }));
  });
}
```

### Step 3: 差分検出（ER図モードの場合）

pullで取得した構造と元の設計書を比較して差分を検出する。

**比較対象**: `アプリアーキテクチャ_*.md` のER図セクション

**差分カテゴリ**:

| 差分種別 | 検出方法 | 対応アクション |
|---------|---------|--------------|
| テーブル追加 | pull結果に設計書にないテーブルがある | アーキテクチャ書にアプリを追加 |
| テーブル削除 | 設計書にpull結果にないテーブルがある | アーキテクチャ書からアプリを削除 |
| フィールド追加 | テーブル内に設計書にないフィールドがある | キーフィールド設計を更新 |
| フィールド削除 | 設計書にpull結果にないフィールドがある | キーフィールド設計から削除 |
| フィールド型変更 | 同名フィールドのtypeが異なる | キーフィールド設計の型を更新 |
| エッジ追加 | pull結果に設計書にないリレーションがある | 連携詳細を追加 |
| エッジ削除 | 設計書にpull結果にないリレーションがある | 連携詳細から削除 |

**差分レポート形式**:
```markdown
## draw.io 修正内容

| 変更種別 | 対象 | 詳細 |
|---------|------|------|
| フィールド追加 | ACTIVITY | string memo |
| テーブル追加 | PRODUCT | 新規テーブル（3フィールド） |
```

### Step 4: 設計書更新

差分がある場合、以下のファイルを更新:

1. `アプリアーキテクチャ_*.md` — ER図(Mermaid)、アプリ一覧、キーフィールド設計を更新
2. 差分内容をユーザーに表示して確認

## 技術詳細

### なぜこのテクニックが必要か

draw.ioはmxGraphライブラリを使用しているが、`EditorUi` インスタンスはクロージャ内に隠蔽されてグローバルからアクセスできない。そのため:

1. `mxGraph.prototype.getModel` をhookして、呼び出し時にインスタンスを捕捉
2. DOMイベント（mousemove）でmxGraphの内部処理をトリガー
3. 捕捉したモデルを `mxCodec` でXMLにエンコード
4. hookは即時復元（1回限りの使い捨て）

### draw.ioのER図セル構造

Mermaid erDiagram → draw.io変換後のセル階層:

```
Level 1: shape=table（テーブルヘッダー）
  └─ Level 2: shape=tableRow（行コンテナ、非表示）
       └─ Level 3: shape=partialRectangle（セル値: 型名, フィールド名, PK/FK）
```

### 制約事項

- Playwright MCPが利用可能であること（`browser_evaluate` が必要）
- draw.ioがブラウザで開かれた状態であること
- 抽出は手動トリガー（ユーザーが「修正した」と伝えた時に実行）
- draw.io → Claude方向の自動通知は不可（Playwright MCPの仕様上）
