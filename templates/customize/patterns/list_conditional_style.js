/**
 * パターン: 一覧画面条件書式
 * 説明: 条件に応じてレコード一覧の行に背景色を設定する
 *
 * パラメータ:
 *   {{CONDITIONS}} - 条件設定の配列（JSON形式）
 *     [
 *       {
 *         "field": "status",
 *         "operator": "equals",
 *         "value": "完了",
 *         "backgroundColor": "#d4edda",
 *         "textColor": "#155724"
 *       },
 *       {
 *         "field": "priority",
 *         "operator": "equals",
 *         "value": "高",
 *         "backgroundColor": "#f8d7da",
 *         "textColor": "#721c24"
 *       }
 *     ]
 *   operator: "equals" | "notEquals" | "contains" | "greaterThan" | "lessThan" | "empty" | "notEmpty"
 */
(function() {
  'use strict';

  // 設定
  var CONDITIONS = {{CONDITIONS}};

  /**
   * 条件を評価
   * @param {*} value - フィールド値
   * @param {string} operator - 演算子
   * @param {*} conditionValue - 条件値
   * @returns {boolean}
   */
  function evaluateCondition(value, operator, conditionValue) {
    switch (operator) {
      case 'equals':
        return value === conditionValue;
      case 'notEquals':
        return value !== conditionValue;
      case 'contains':
        return String(value).indexOf(conditionValue) !== -1;
      case 'greaterThan':
        return Number(value) > Number(conditionValue);
      case 'lessThan':
        return Number(value) < Number(conditionValue);
      case 'empty':
        return value === null || value === undefined || value === '';
      case 'notEmpty':
        return value !== null && value !== undefined && value !== '';
      default:
        return false;
    }
  }

  /**
   * 条件書式を適用
   * @param {Array} records - レコード配列
   */
  function applyConditionalStyles(records) {
    // 一覧のテーブル行を取得
    var rows = document.querySelectorAll('.recordlist-row-gaia');

    records.forEach(function(record, index) {
      var row = rows[index];
      if (!row) {
        return;
      }

      // 各条件をチェック
      CONDITIONS.forEach(function(condition) {
        var fieldValue = record[condition.field] ? record[condition.field].value : null;
        var isMatch = evaluateCondition(fieldValue, condition.operator, condition.value);

        if (isMatch) {
          if (condition.backgroundColor) {
            row.style.backgroundColor = condition.backgroundColor;
          }
          if (condition.textColor) {
            row.style.color = condition.textColor;
          }
        }
      });
    });
  }

  // イベント登録
  kintone.events.on('app.record.index.show', function(event) {
    // 少し遅延させてDOMが描画されてから適用
    setTimeout(function() {
      applyConditionalStyles(event.records);
    }, 100);

    return event;
  });

})();
