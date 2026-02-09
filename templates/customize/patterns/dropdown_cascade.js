/**
 * パターン: ドロップダウン連動
 * 説明: ドロップダウンの値によって別フィールドの値を変更/無効化する
 *
 * パラメータ:
 *   {{TRIGGER_FIELD}} - トリガーとなるドロップダウンフィールドコード
 *   {{CASCADE_CONFIG}} - 連動設定の配列（JSON形式）
 *     [
 *       {
 *         "triggerValue": "オプションA",
 *         "actions": [
 *           {"field": "target_field1", "action": "setValue", "value": "自動入力値"},
 *           {"field": "target_field2", "action": "disable"},
 *           {"field": "target_field3", "action": "enable"},
 *           {"field": "target_field4", "action": "clear"}
 *         ]
 *       }
 *     ]
 */
(function() {
  'use strict';

  // 設定
  var TRIGGER_FIELD = '{{TRIGGER_FIELD}}';
  var CASCADE_CONFIG = {{CASCADE_CONFIG}};

  /**
   * 連動処理を実行
   * @param {Object} record - kintoneレコード
   */
  function applyCascade(record) {
    var triggerValue = record[TRIGGER_FIELD].value;

    // 該当する設定を検索
    var config = CASCADE_CONFIG.find(function(c) {
      return c.triggerValue === triggerValue;
    });

    if (!config) {
      return;
    }

    // 各アクションを実行
    config.actions.forEach(function(action) {
      switch (action.action) {
        case 'setValue':
          record[action.field].value = action.value;
          break;
        case 'disable':
          record[action.field].disabled = true;
          break;
        case 'enable':
          record[action.field].disabled = false;
          break;
        case 'clear':
          record[action.field].value = '';
          break;
      }
    });
  }

  // イベント登録（画面表示時）
  var showEvents = [
    'app.record.create.show',
    'app.record.edit.show'
  ];

  kintone.events.on(showEvents, function(event) {
    applyCascade(event.record);
    return event;
  });

  // イベント登録（値変更時）
  var changeEvents = [
    'app.record.create.change.' + TRIGGER_FIELD,
    'app.record.edit.change.' + TRIGGER_FIELD
  ];

  kintone.events.on(changeEvents, function(event) {
    applyCascade(event.record);
    return event;
  });

})();
