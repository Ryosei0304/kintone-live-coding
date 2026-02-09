/**
 * パターン: 一覧画面ボタン追加
 * 説明: レコード一覧画面にカスタムボタンを追加する
 *
 * パラメータ:
 *   {{BUTTONS}} - ボタン設定の配列（JSON形式）
 *     [
 *       {
 *         "id": "btn_export",
 *         "label": "エクスポート",
 *         "action": "custom",
 *         "functionName": "handleExport"
 *       },
 *       {
 *         "id": "btn_refresh",
 *         "label": "更新",
 *         "action": "reload"
 *       }
 *     ]
 *   action: "reload" | "custom" | "openUrl"
 *   url: URLを開く場合のURL（action: "openUrl"の場合）
 *   functionName: カスタム関数名（action: "custom"の場合、グローバルスコープに定義が必要）
 */
(function() {
  'use strict';

  // 設定
  var BUTTONS = {{BUTTONS}};

  /**
   * ボタンクリック時の処理
   * @param {Object} config - ボタン設定
   */
  function handleButtonClick(config) {
    switch (config.action) {
      case 'reload':
        location.reload();
        break;
      case 'openUrl':
        if (config.url) {
          window.open(config.url, '_blank');
        }
        break;
      case 'custom':
        if (config.functionName && typeof window[config.functionName] === 'function') {
          window[config.functionName]();
        }
        break;
    }
  }

  /**
   * ボタンを作成
   * @param {Object} config - ボタン設定
   * @returns {HTMLElement} - ボタン要素
   */
  function createButton(config) {
    var button = document.createElement('button');
    button.id = config.id;
    button.textContent = config.label;
    button.className = 'kintoneplugin-button-dialog-ok custom-list-button';
    button.style.marginRight = '8px';
    button.addEventListener('click', function() {
      handleButtonClick(config);
    });
    return button;
  }

  /**
   * スタイルを追加
   */
  function addStyles() {
    var styleId = 'list-button-styles';
    if (document.getElementById(styleId)) {
      return;
    }

    var style = document.createElement('style');
    style.id = styleId;
    style.textContent = [
      '.custom-list-button { min-width: 80px; }',
      '.custom-list-button:hover { opacity: 0.8; }'
    ].join('\n');
    document.head.appendChild(style);
  }

  // イベント登録
  kintone.events.on('app.record.index.show', function(event) {
    // 既に追加済みの場合はスキップ
    if (document.getElementById(BUTTONS[0].id)) {
      return event;
    }

    var headerSpace = kintone.app.getHeaderMenuSpaceElement();
    if (!headerSpace) {
      return event;
    }

    addStyles();

    // ボタンを追加
    BUTTONS.forEach(function(config) {
      var button = createButton(config);
      headerSpace.appendChild(button);
    });

    return event;
  });

})();
