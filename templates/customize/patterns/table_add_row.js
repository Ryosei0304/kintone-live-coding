/**
 * パターン: テーブル行追加ボタン
 * 説明: ボタンクリックでテーブルに行を追加する
 *
 * パラメータ:
 *   {{TABLE_FIELD}} - テーブルフィールドコード
 *   {{BUTTON_SPACE}} - ボタン表示用スペースの要素ID
 *   {{BUTTON_LABEL}} - ボタンのラベル
 *   {{DEFAULT_VALUES}} - 追加行のデフォルト値（JSON形式）
 *     {
 *       "field_code1": "デフォルト値1",
 *       "field_code2": "デフォルト値2"
 *     }
 */
(function() {
  'use strict';

  // 設定
  var TABLE_FIELD = '{{TABLE_FIELD}}';
  var BUTTON_SPACE = '{{BUTTON_SPACE}}';
  var BUTTON_LABEL = '{{BUTTON_LABEL}}';
  var DEFAULT_VALUES = {{DEFAULT_VALUES}};

  /**
   * テーブルに行を追加
   */
  function addTableRow() {
    var record = kintone.app.record.get();
    var table = record.record[TABLE_FIELD].value;

    // 新しい行を作成
    var newRow = {
      value: {}
    };

    // デフォルト値を設定
    Object.keys(DEFAULT_VALUES).forEach(function(fieldCode) {
      newRow.value[fieldCode] = {
        type: 'SINGLE_LINE_TEXT',
        value: DEFAULT_VALUES[fieldCode]
      };
    });

    // 行を追加
    table.push(newRow);
    record.record[TABLE_FIELD].value = table;

    // レコードを更新
    kintone.app.record.set(record);
  }

  /**
   * ボタンを作成
   * @returns {HTMLElement}
   */
  function createAddButton() {
    var button = document.createElement('button');
    button.textContent = BUTTON_LABEL;
    button.className = 'kintoneplugin-button-normal';
    button.addEventListener('click', function(e) {
      e.preventDefault();
      addTableRow();
    });
    return button;
  }

  // イベント登録
  var events = [
    'app.record.create.show',
    'app.record.edit.show'
  ];

  kintone.events.on(events, function(event) {
    var spaceEl = kintone.app.record.getSpaceElement(BUTTON_SPACE);
    if (!spaceEl) {
      return event;
    }

    // 既に追加済みの場合はスキップ
    if (spaceEl.querySelector('button')) {
      return event;
    }

    var button = createAddButton();
    spaceEl.appendChild(button);

    return event;
  });

})();
