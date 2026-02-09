/**
 * パターン: ステータス分岐制御
 * 説明: ステータスフィールドの値に応じて処理を分岐
 *
 * パラメータ:
 *   {{STATUS_FIELD}} - ステータスフィールドコード
 *   {{CONDITIONS}} - 条件と処理の配列（JSON形式）
 *     [
 *       {
 *         "status": "完了",
 *         "action": "disable",
 *         "target_fields": ["field1", "field2"]
 *       },
 *       {
 *         "status": "進行中",
 *         "action": "show_hide",
 *         "target_fields": ["field3"],
 *         "show": true
 *       }
 *     ]
 */
(function() {
  'use strict';

  // 設定
  var STATUS_FIELD = '{{STATUS_FIELD}}';
  var CONDITIONS = {{CONDITIONS}};

  /**
   * ステータスに応じた処理を実行
   * @param {Object} record - kintoneレコード
   */
  function applyStatusConditions(record) {
    var currentStatus = record[STATUS_FIELD].value;

    CONDITIONS.forEach(function(condition) {
      if (condition.status === currentStatus) {
        switch (condition.action) {
          case 'disable':
            // フィールドを編集不可にする
            condition.target_fields.forEach(function(fieldCode) {
              if (record[fieldCode]) {
                record[fieldCode].disabled = true;
              }
            });
            break;

          case 'enable':
            // フィールドを編集可能にする
            condition.target_fields.forEach(function(fieldCode) {
              if (record[fieldCode]) {
                record[fieldCode].disabled = false;
              }
            });
            break;

          case 'show':
            // フィールドを表示する
            condition.target_fields.forEach(function(fieldCode) {
              kintone.app.record.setFieldShown(fieldCode, true);
            });
            break;

          case 'hide':
            // フィールドを非表示にする
            condition.target_fields.forEach(function(fieldCode) {
              kintone.app.record.setFieldShown(fieldCode, false);
            });
            break;

          case 'set_value':
            // フィールドに値をセットする
            condition.target_fields.forEach(function(fieldCode) {
              if (record[fieldCode]) {
                record[fieldCode].value = condition.value;
              }
            });
            break;
        }
      }
    });
  }

  // イベント登録
  var events = [
    'app.record.create.show',
    'app.record.edit.show',
    'app.record.create.change.' + STATUS_FIELD,
    'app.record.edit.change.' + STATUS_FIELD
  ];

  kintone.events.on(events, function(event) {
    applyStatusConditions(event.record);
    return event;
  });

})();
