/**
 * パターン: グループフィールド開閉制御
 * 説明: 条件に応じてグループフィールドの開閉を自動制御する
 *
 * パラメータ:
 *   {{TRIGGER_FIELD}} - トリガーとなるフィールドコード
 *   {{GROUP_CONFIG}} - グループ開閉設定の配列（JSON形式）
 *     [
 *       {
 *         "groupField": "group_field_code",
 *         "openWhen": "条件値",
 *         "operator": "equals" | "notEquals" | "contains" | "notEmpty"
 *       }
 *     ]
 */
(function() {
  'use strict';

  // 設定
  var TRIGGER_FIELD = '{{TRIGGER_FIELD}}';
  var GROUP_CONFIG = {{GROUP_CONFIG}};

  /**
   * 条件を評価
   * @param {*} value - フィールドの値
   * @param {string} openWhen - 条件値
   * @param {string} operator - 演算子
   * @returns {boolean} - 条件を満たすかどうか
   */
  function evaluateCondition(value, openWhen, operator) {
    switch (operator) {
      case 'equals':
        return value === openWhen;
      case 'notEquals':
        return value !== openWhen;
      case 'contains':
        return String(value).indexOf(openWhen) !== -1;
      case 'notEmpty':
        if (Array.isArray(value)) {
          return value.length > 0;
        }
        return value !== null && value !== undefined && value !== '';
      default:
        return value === openWhen;
    }
  }

  /**
   * グループフィールドの開閉を制御
   * @param {Object} record - kintoneレコード
   */
  function toggleGroups(record) {
    var triggerValue = record[TRIGGER_FIELD].value;

    GROUP_CONFIG.forEach(function(config) {
      var shouldOpen = evaluateCondition(triggerValue, config.openWhen, config.operator);
      kintone.app.record.setGroupFieldOpen(config.groupField, shouldOpen);
    });
  }

  // イベント登録（画面表示時）
  var showEvents = [
    'app.record.create.show',
    'app.record.edit.show',
    'app.record.detail.show'
  ];

  kintone.events.on(showEvents, function(event) {
    toggleGroups(event.record);
    return event;
  });

  // イベント登録（値変更時）
  var changeEvents = [
    'app.record.create.change.' + TRIGGER_FIELD,
    'app.record.edit.change.' + TRIGGER_FIELD
  ];

  kintone.events.on(changeEvents, function(event) {
    toggleGroups(event.record);
    return event;
  });

})();
