/**
 * draw.io Pull Mechanism - Extract diagram data via Playwright MCP
 *
 * Usage: Execute this script's exported functions via Playwright's browser_evaluate
 * when a draw.io page is open in the browser.
 *
 * Technique: Hook mxGraph.prototype.getModel, trigger via DOM event,
 * capture the graph instance, encode to XML via mxCodec.
 *
 * Supported diagram types:
 * - ER diagrams (Mermaid erDiagram → draw.io table format)
 * - Sequence diagrams (basic shape extraction)
 * - Flowcharts (basic shape extraction)
 */

// =============================================================================
// 1. Raw XML extraction - Returns full mxGraphModel XML
// =============================================================================
const EXTRACT_RAW_XML = `() => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject('Timeout: could not capture graph instance'), 5000);

    const origGetModel = mxGraph.prototype.getModel;
    mxGraph.prototype.getModel = function() {
      mxGraph.prototype.getModel = origGetModel;
      clearTimeout(timeout);

      const model = origGetModel.call(this);
      try {
        const codec = new mxCodec();
        const node = codec.encode(model);
        const xml = mxUtils.getXml(node);
        resolve(xml);
      } catch(err) {
        reject('XML encode error: ' + err.message);
      }
      return model;
    };

    const container = document.querySelector('.geDiagramContainer');
    if (container) {
      container.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 100, clientY: 100 }));
    } else {
      clearTimeout(timeout);
      reject('No .geDiagramContainer found - is draw.io loaded?');
    }
  });
}`;

// =============================================================================
// 2. ER Diagram parser - Returns structured table/field/edge data
// =============================================================================
const EXTRACT_ER_DIAGRAM = `() => {
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

      // Build parent-child map
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

      // Find tables (shape=table)
      const tables = [];
      cells.forEach(cell => {
        const style = cell.getAttribute('style') || '';
        if (style.includes('shape=table') && !style.includes('shape=tableRow')) {
          const tableId = cell.getAttribute('id');
          const tableName = (cell.getAttribute('value') || '').replace(/<[^>]*>/g, '').trim();

          // Get row containers (direct children of table)
          const rowContainers = childrenOf[tableId] || [];

          const fields = [];
          rowContainers.forEach(rowCell => {
            const rowId = rowCell.getAttribute('id');
            const rowChildren = childrenOf[rowId] || [];
            const cellValues = rowChildren.map(c =>
              (c.getAttribute('value') || '').replace(/<[^>]*>/g, '').trim()
            );

            if (cellValues.length >= 2) {
              const field = { type: cellValues[0], name: cellValues[1] };
              if (cellValues[2]) field.constraint = cellValues[2];
              fields.push(field);
            }
          });

          tables.push({ id: tableId, name: tableName, fields });
        }
      });

      // Find edges
      const edges = [];
      const tableIdMap = {};
      tables.forEach(t => tableIdMap[t.id] = t.name);

      cells.forEach(cell => {
        const source = cell.getAttribute('source');
        const target = cell.getAttribute('target');
        if (source && target) {
          const label = (cell.getAttribute('value') || '').replace(/<[^>]*>/g, '').trim();
          const style = cell.getAttribute('style') || '';

          let relType = label || 'relates';
          if (style.includes('ERmandOne') && style.includes('ERzeroToMany')) {
            relType = label || '1:N';
          } else if (style.includes('ERzeroToMany') && style.includes('ERzeroToMany')) {
            relType = label || 'N:M';
          } else if (style.includes('ERmandOne') && style.includes('ERmandOne')) {
            relType = label || '1:1';
          }

          let fromTable = tableIdMap[source];
          let toTable = tableIdMap[target];
          if (!fromTable) {
            const parentId = cellMap[source]?.getAttribute('parent');
            fromTable = tableIdMap[parentId] || source;
          }
          if (!toTable) {
            const parentId = cellMap[target]?.getAttribute('parent');
            toTable = tableIdMap[parentId] || target;
          }

          edges.push({ from: fromTable, to: toTable, type: relType });
        }
      });

      resolve(JSON.stringify({
        success: true,
        diagramType: 'er',
        tables: tables.map(t => ({ name: t.name, fields: t.fields })),
        edges,
        stats: {
          tables: tables.length,
          totalFields: tables.reduce((sum, t) => sum + t.fields.length, 0),
          edges: edges.length
        }
      }, null, 2));
      return model;
    };

    document.querySelector('.geDiagramContainer')
      .dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 100, clientY: 100 }));
  });
}`;

// =============================================================================
// 3. Generic shape extractor - Returns all shapes and connections
// =============================================================================
const EXTRACT_ALL_SHAPES = `() => {
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
          connections.push({
            id,
            source,
            target,
            label: value.replace(/<[^>]*>/g, '').trim()
          });
        } else if (style && value) {
          const geo = cell.querySelector('mxGeometry');
          shapes.push({
            id,
            parent,
            value: value.replace(/<[^>]*>/g, '').trim(),
            style: style.substring(0, 80),
            x: geo?.getAttribute('x'),
            y: geo?.getAttribute('y'),
            width: geo?.getAttribute('width'),
            height: geo?.getAttribute('height')
          });
        }
      });

      resolve(JSON.stringify({
        success: true,
        diagramType: 'generic',
        shapes,
        connections,
        stats: { shapes: shapes.length, connections: connections.length }
      }, null, 2));
      return model;
    };

    document.querySelector('.geDiagramContainer')
      .dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 100, clientY: 100 }));
  });
}`;

// =============================================================================
// 4. ER → Mermaid converter - Returns Mermaid erDiagram source
// =============================================================================
const EXTRACT_AS_MERMAID = `() => {
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

      // Extract tables
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

      // Extract edges
      const tableIdMap = {};
      tables.forEach(t => tableIdMap[t.id] = t.name);

      const edges = [];
      cells.forEach(cell => {
        const source = cell.getAttribute('source');
        const target = cell.getAttribute('target');
        if (source && target) {
          const label = (cell.getAttribute('value') || '').replace(/<[^>]*>/g, '').trim();
          const style = cell.getAttribute('style') || '';
          let fromTable = tableIdMap[source];
          let toTable = tableIdMap[target];
          if (!fromTable) fromTable = tableIdMap[cellMap[source]?.getAttribute('parent')] || source;
          if (!toTable) toTable = tableIdMap[cellMap[target]?.getAttribute('parent')] || target;

          let rel = '||--o{';
          if (style.includes('ERmandOne') && style.includes('ERmandOne')) rel = '||--||';
          edges.push({ from: fromTable, to: toTable, rel, label: label || '' });
        }
      });

      // Build Mermaid source
      let mermaid = 'erDiagram\\n';
      edges.forEach(e => {
        mermaid += '    ' + e.from + ' ' + e.rel + ' ' + e.to + ' : "' + e.label + '"\\n';
      });
      mermaid += '\\n';
      tables.forEach(t => {
        mermaid += '    ' + t.name + ' {\\n';
        t.fields.forEach(f => {
          const c = f.constraint ? ' ' + f.constraint : '';
          mermaid += '        ' + f.type + ' ' + f.name + c + '\\n';
        });
        mermaid += '    }\\n\\n';
      });

      resolve(JSON.stringify({ success: true, mermaid }, null, 2));
      return model;
    };

    document.querySelector('.geDiagramContainer')
      .dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 100, clientY: 100 }));
  });
}`;

// Export for reference (these are string templates for Playwright browser_evaluate)
module.exports = {
  EXTRACT_RAW_XML,
  EXTRACT_ER_DIAGRAM,
  EXTRACT_ALL_SHAPES,
  EXTRACT_AS_MERMAID,
};
