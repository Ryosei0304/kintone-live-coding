/**
 * パターン: セクション見出し
 * 説明: スペーサーにセクション見出しを追加してフォームをグルーピング
 *
 * パラメータ:
 *   {{SECTIONS}} - セクション定義の配列（JSON形式）
 *     [
 *       {
 *         "space_id": "space_basic_info",
 *         "label": "基本情報",
 *         "icon": "user"
 *       },
 *       {
 *         "space_id": "space_detail_info",
 *         "label": "詳細情報",
 *         "icon": "list"
 *       }
 *     ]
 */
(function() {
  'use strict';

  // 設定
  var SECTIONS = {{SECTIONS}};

  // アイコンマッピング
  var ICON_MAP = {
    'user': '\u{1F464}',
    'users': '\u{1F465}',
    'list': '\u{1F4CB}',
    'file': '\u{1F4C4}',
    'folder': '\u{1F4C1}',
    'calendar': '\u{1F4C5}',
    'clock': '\u{1F551}',
    'money': '\u{1F4B0}',
    'chart': '\u{1F4CA}',
    'check': '\u{2705}',
    'star': '\u{2B50}',
    'info': '\u{2139}\uFE0F',
    'warning': '\u{26A0}\uFE0F',
    'settings': '\u{2699}\uFE0F',
    'link': '\u{1F517}',
    'mail': '\u{1F4E7}',
    'phone': '\u{1F4DE}',
    'location': '\u{1F4CD}',
    'note': '\u{1F4DD}',
    'tag': '\u{1F3F7}\uFE0F}'
  };

  /**
   * 要素の子要素を全て削除
   * @param {HTMLElement} element - 対象要素
   */
  function clearElement(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  /**
   * セクション見出しを追加
   */
  function addSectionHeaders() {
    SECTIONS.forEach(function(section) {
      var spaceElement = kintone.app.record.getSpaceElement(section.space_id);

      if (spaceElement) {
        // 既存の内容をクリア（安全なDOM操作）
        clearElement(spaceElement);

        // セクション見出し要素を作成
        var headerDiv = document.createElement('div');
        headerDiv.className = 'kintone-section-header';

        // アイコンがあれば追加
        if (section.icon && ICON_MAP[section.icon]) {
          var iconSpan = document.createElement('span');
          iconSpan.className = 'kintone-section-icon';
          iconSpan.textContent = ICON_MAP[section.icon];
          headerDiv.appendChild(iconSpan);
        }

        // ラベルを追加
        var labelSpan = document.createElement('span');
        labelSpan.className = 'kintone-section-label';
        labelSpan.textContent = section.label;
        headerDiv.appendChild(labelSpan);

        spaceElement.appendChild(headerDiv);
      }
    });
  }

  // イベント登録
  var events = [
    'app.record.create.show',
    'app.record.edit.show',
    'app.record.detail.show'
  ];

  kintone.events.on(events, function(event) {
    addSectionHeaders();
    return event;
  });

})();
