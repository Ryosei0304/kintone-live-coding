/**
 * パターン: 自動ステータス更新
 * 説明: レコード保存時に条件に応じてステータスを自動更新する
 *
 * パラメータ:
 *   {{STATUS_FIELD}} - ステータスフィールドコード
 *   {{RULES}} - ステータス更新ルールの配列（JSON形式）
 *     [
 *       {
 *         "conditions": [
 *           {"field": "approval_flag", "operator": "equals", "value": "承認済み"}
 *         ],
 *         "newStatus": "承認完了",
 *         "fromStatus": ["審査中"]
 *       },
 *       {
 *         "conditions": [
 *           {"field": "reject_flag", "operator": "equals", "value": "却下"}
 *         ],
 *         "newStatus": "却下",
 *         "fromStatus": ["審査中"]
 *       }
 *     ]
 *   operator: "equals" | "notEquals" | "contains" | "empty" | "notEmpty"
 *   fromStatus: この状態の時のみ適用（空配列で全状態対象）
 */
(function() {
  'use strict';

  // 設定
  var STATUS_FIELD = '{{STATUS_FIELD}}';
  var RULES = {{RULES}};

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
      case 'empty':
        return value === null || value === undefined || value === '';
      case 'notEmpty':
        return value !== null && value !== undefined && value !== '';
      default:
        return false;
    }
  }

  /**
   * すべての条件をチェック
   * @param {Object} record - kintoneレコード
   * @param {Array} conditions - 条件配列
   * @returns {boolean}
   */
  function checkAllConditions(record, conditions) {
    return conditions.every(function(condition) {
      var fieldValue = record[condition.field] ? record[condition.field].value : null;
      return evaluateCondition(fieldValue, condition.operator, condition.value);
    });
  }

  /**
   * ステータス更新ルールを適用
   * @param {Object} record - kintoneレコード
   * @returns {boolean} - 更新があったかどうか
   */
  function applyStatusRules(record) {
    var currentStatus = record[STATUS_FIELD].value;

    for (var i = 0; i < RULES.length; i++) {
      var rule = RULES[i];

      // fromStatusが指定されている場合、現在のステータスをチェック
      if (rule.fromStatus && rule.fromStatus.length > 0) {
        if (rule.fromStatus.indexOf(currentStatus) === -1) {
          continue;
        }
      }

      // 条件をチェック
      if (checkAllConditions(record, rule.conditions)) {
        record[STATUS_FIELD].value = rule.newStatus;
        return true;
      }
    }

    return false;
  }

  // イベント登録
  var events = [
    'app.record.create.submit',
    'app.record.edit.submit'
  ];

  kintone.events.on(events, function(event) {
    applyStatusRules(event.record);
    return event;
  });

})();
