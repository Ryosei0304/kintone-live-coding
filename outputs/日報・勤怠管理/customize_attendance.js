/**
 * 勤怠管理カスタマイズ
 * C-002: 承認後編集不可
 *
 * パターン: field_disable
 * トリガー条件: ステータス = "承認済"
 * 対象フィールド: attendance_date, employee_id, clock_in, clock_out, break_time, work_type, notes
 */
(function() {
  'use strict';

  // ========================================
  // C-002: 承認後編集不可
  // ========================================

  // 設定
  var TRIGGER_FIELD = 'ステータス';
  var CONDITION_VALUE = '承認済';
  var TARGET_FIELDS = ['attendance_date', 'employee_id', 'clock_in', 'clock_out', 'break_time', 'work_type', 'notes'];
  var DISABLE_WHEN_MATCH = true;

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

  // イベント登録（編集画面表示時のみ）
  var events = [
    'app.record.edit.show'
  ];

  kintone.events.on(events, function(event) {
    toggleFieldDisabled(event.record);
    return event;
  });

})();
