/**
 * パターン: フィールド編集不可制御
 * 説明: 特定の条件でフィールドを編集不可にする
 *
 * パラメータ:
 *   {{TRIGGER_FIELD}} - トリガーとなるフィールドコード
 *   {{CONDITION_VALUE}} - 条件となる値
 *   {{TARGET_FIELDS}} - 対象フィールドコードの配列（JSON形式）
 *   {{DISABLE_WHEN_MATCH}} - 条件一致時に編集不可にするか（true/false）
 */
(function() {
  'use strict';

  // 設定
  var TRIGGER_FIELD = '{{TRIGGER_FIELD}}';
  var CONDITION_VALUE = '{{CONDITION_VALUE}}';
  var TARGET_FIELDS = {{TARGET_FIELDS}};
  var DISABLE_WHEN_MATCH = {{DISABLE_WHEN_MATCH}};

  /**
   * フィールドの編集可否を切り替える
   * @param {Object} record - kintoneレコード
   */
  function toggleFieldDisabled(record) {
    var triggerValue = record[TRIGGER_FIELD].value;
    var isMatch = triggerValue === CONDITION_VALUE;
    var shouldDisable = DISABLE_WHEN_MATCH ? isMatch : !isMatch;

    TARGET_FIELDS.forEach(function(fieldCode) {
      if (record[fieldCode]) {
        record[fieldCode].disabled = shouldDisable;
      }
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
    toggleFieldDisabled(event.record);
    return event;
  });

})();
