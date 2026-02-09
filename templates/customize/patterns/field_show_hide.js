/**
 * パターン: フィールド表示/非表示制御
 * 説明: 特定の条件でフィールドを表示/非表示にする
 *
 * パラメータ:
 *   {{TRIGGER_FIELD}} - トリガーとなるフィールドコード
 *   {{CONDITION_VALUE}} - 条件となる値
 *   {{TARGET_FIELDS}} - 対象フィールドコードの配列（JSON形式）
 *   {{SHOW_WHEN_MATCH}} - 条件一致時に表示するか（true/false）
 */
(function() {
  'use strict';

  // 設定
  var TRIGGER_FIELD = '{{TRIGGER_FIELD}}';
  var CONDITION_VALUE = '{{CONDITION_VALUE}}';
  var TARGET_FIELDS = {{TARGET_FIELDS}};
  var SHOW_WHEN_MATCH = {{SHOW_WHEN_MATCH}};

  /**
   * フィールドの表示/非表示を切り替える
   * @param {Object} record - kintoneレコード
   */
  function toggleFieldVisibility(record) {
    var triggerValue = record[TRIGGER_FIELD].value;
    var isMatch = triggerValue === CONDITION_VALUE;
    var shouldShow = SHOW_WHEN_MATCH ? isMatch : !isMatch;

    TARGET_FIELDS.forEach(function(fieldCode) {
      kintone.app.record.setFieldShown(fieldCode, shouldShow);
    });
  }

  // イベント登録
  var events = [
    'app.record.create.show',
    'app.record.edit.show',
    'app.record.create.change.' + TRIGGER_FIELD,
    'app.record.edit.change.' + TRIGGER_FIELD
  ];

  kintone.events.on(events, function(event) {
    toggleFieldVisibility(event.record);
    return event;
  });

})();
