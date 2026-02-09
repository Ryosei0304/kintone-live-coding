/**
 * パターン: テーブル合計計算
 * 説明: テーブル内の数値フィールドを合計して表示する
 *
 * パラメータ:
 *   {{TABLE_FIELD}} - テーブルフィールドコード
 *   {{CALCULATIONS}} - 計算設定の配列（JSON形式）
 *     [
 *       {
 *         "sourceField": "amount",
 *         "targetField": "total_amount",
 *         "operation": "sum"
 *       },
 *       {
 *         "sourceField": "quantity",
 *         "targetField": "total_quantity",
 *         "operation": "sum"
 *       }
 *     ]
 *   operation: "sum" | "average" | "count" | "max" | "min"
 */
(function() {
  'use strict';

  // 設定
  var TABLE_FIELD = '{{TABLE_FIELD}}';
  var CALCULATIONS = {{CALCULATIONS}};

  /**
   * テーブルの値を集計
   * @param {Array} tableRows - テーブルの行配列
   * @param {string} fieldCode - フィールドコード
   * @param {string} operation - 演算種類
   * @returns {number} - 計算結果
   */
  function calculate(tableRows, fieldCode, operation) {
    var values = tableRows.map(function(row) {
      var value = row.value[fieldCode] ? row.value[fieldCode].value : 0;
      return Number(value) || 0;
    }).filter(function(v) {
      return !isNaN(v);
    });

    if (values.length === 0) {
      return 0;
    }

    switch (operation) {
      case 'sum':
        return values.reduce(function(a, b) { return a + b; }, 0);
      case 'average':
        var sum = values.reduce(function(a, b) { return a + b; }, 0);
        return sum / values.length;
      case 'count':
        return values.length;
      case 'max':
        return Math.max.apply(null, values);
      case 'min':
        return Math.min.apply(null, values);
      default:
        return 0;
    }
  }

  /**
   * 合計を更新
   * @param {Object} record - kintoneレコード
   */
  function updateTotals(record) {
    var tableRows = record[TABLE_FIELD].value || [];

    CALCULATIONS.forEach(function(config) {
      var result = calculate(tableRows, config.sourceField, config.operation);
      record[config.targetField].value = result;
    });
  }

  // イベント登録（画面表示時）
  var showEvents = [
    'app.record.create.show',
    'app.record.edit.show'
  ];

  kintone.events.on(showEvents, function(event) {
    updateTotals(event.record);
    return event;
  });

  // イベント登録（テーブル変更時）
  var changeEvents = [
    'app.record.create.change.' + TABLE_FIELD,
    'app.record.edit.change.' + TABLE_FIELD
  ];

  kintone.events.on(changeEvents, function(event) {
    updateTotals(event.record);
    return event;
  });

})();
