/**
 * パターン: 文字数カウント表示
 * 説明: 入力文字数をリアルタイムで表示する
 *
 * パラメータ:
 *   {{TARGET_FIELD}} - 文字数をカウントするフィールドコード
 *   {{DISPLAY_SPACE}} - カウント表示用スペースの要素ID
 *   {{MAX_LENGTH}} - 最大文字数（警告表示用、0で無制限）
 */
(function() {
  'use strict';

  // 設定
  var TARGET_FIELD = '{{TARGET_FIELD}}';
  var DISPLAY_SPACE = '{{DISPLAY_SPACE}}';
  var MAX_LENGTH = {{MAX_LENGTH}};

  /**
   * 文字数カウント表示を更新
   * @param {Object} record - kintoneレコード
   */
  function updateCharCount(record) {
    var spaceEl = kintone.app.record.getSpaceElement(DISPLAY_SPACE);
    if (!spaceEl) {
      return;
    }

    var value = record[TARGET_FIELD].value || '';
    var count = value.length;

    // 既存の表示をクリア
    spaceEl.textContent = '';

    // 表示要素を作成
    var span = document.createElement('span');
    span.className = 'char-count';

    if (MAX_LENGTH > 0) {
      span.textContent = count + ' / ' + MAX_LENGTH + '文字';
      if (count > MAX_LENGTH) {
        span.classList.add('char-count-over');
      } else if (count > MAX_LENGTH * 0.9) {
        span.classList.add('char-count-warning');
      }
    } else {
      span.textContent = count + '文字';
    }

    spaceEl.appendChild(span);
  }

  /**
   * スタイルを追加
   */
  function addStyles() {
    var styleId = 'char-count-styles';
    if (document.getElementById(styleId)) {
      return;
    }

    var style = document.createElement('style');
    style.id = styleId;
    style.textContent = [
      '.char-count { font-size: 12px; color: #666; }',
      '.char-count-warning { color: #f90; }',
      '.char-count-over { color: #e00; font-weight: bold; }'
    ].join('\n');
    document.head.appendChild(style);
  }

  // イベント登録（画面表示時）
  var showEvents = [
    'app.record.create.show',
    'app.record.edit.show'
  ];

  kintone.events.on(showEvents, function(event) {
    addStyles();
    updateCharCount(event.record);
    return event;
  });

  // イベント登録（値変更時）
  var changeEvents = [
    'app.record.create.change.' + TARGET_FIELD,
    'app.record.edit.change.' + TARGET_FIELD
  ];

  kintone.events.on(changeEvents, function(event) {
    updateCharCount(event.record);
    return event;
  });

})();
