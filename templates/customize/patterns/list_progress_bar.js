/**
 * パターン: プログレスバー表示
 * 説明: 一覧画面でステータスをプログレスバーとして視覚化する
 *
 * パラメータ:
 *   {{STATUS_FIELD}} - ステータスフィールドコード
 *   {{DISPLAY_SPACE}} - プログレスバー表示用スペースの要素ID
 *   {{STEPS}} - ステップ設定の配列（JSON形式）
 *     [
 *       {"value": "未着手", "label": "未着手", "color": "#ccc"},
 *       {"value": "進行中", "label": "進行中", "color": "#17a2b8"},
 *       {"value": "レビュー中", "label": "レビュー", "color": "#ffc107"},
 *       {"value": "完了", "label": "完了", "color": "#28a745"}
 *     ]
 */
(function() {
  'use strict';

  // 設定
  var STATUS_FIELD = '{{STATUS_FIELD}}';
  var DISPLAY_SPACE = '{{DISPLAY_SPACE}}';
  var STEPS = {{STEPS}};

  /**
   * プログレスバーを作成
   * @param {string} currentStatus - 現在のステータス
   * @returns {HTMLElement}
   */
  function createProgressBar(currentStatus) {
    var container = document.createElement('div');
    container.className = 'progress-bar-container';

    var currentIndex = STEPS.findIndex(function(step) {
      return step.value === currentStatus;
    });

    STEPS.forEach(function(step, index) {
      var stepEl = document.createElement('div');
      stepEl.className = 'progress-step';

      var isCompleted = index <= currentIndex;
      var isCurrent = index === currentIndex;

      // ステップ丸
      var circle = document.createElement('div');
      circle.className = 'progress-circle';
      if (isCompleted) {
        circle.style.backgroundColor = step.color;
        circle.style.borderColor = step.color;
      }
      if (isCurrent) {
        circle.classList.add('current');
      }

      // ラベル
      var label = document.createElement('div');
      label.className = 'progress-label';
      label.textContent = step.label;

      stepEl.appendChild(circle);
      stepEl.appendChild(label);
      container.appendChild(stepEl);

      // コネクター（最後以外）
      if (index < STEPS.length - 1) {
        var connector = document.createElement('div');
        connector.className = 'progress-connector';
        if (index < currentIndex) {
          connector.style.backgroundColor = STEPS[index + 1].color;
        }
        container.appendChild(connector);
      }
    });

    return container;
  }

  /**
   * スタイルを追加
   */
  function addStyles() {
    var styleId = 'progress-bar-styles';
    if (document.getElementById(styleId)) {
      return;
    }

    var style = document.createElement('style');
    style.id = styleId;
    style.textContent = [
      '.progress-bar-container { display: flex; align-items: center; padding: 8px 0; }',
      '.progress-step { display: flex; flex-direction: column; align-items: center; }',
      '.progress-circle { width: 24px; height: 24px; border-radius: 50%; border: 2px solid #ccc; background: #fff; }',
      '.progress-circle.current { box-shadow: 0 0 0 3px rgba(0,123,255,0.25); }',
      '.progress-label { font-size: 10px; margin-top: 4px; color: #666; }',
      '.progress-connector { width: 40px; height: 3px; background: #ccc; margin: 0 4px; margin-bottom: 18px; }'
    ].join('\n');
    document.head.appendChild(style);
  }

  // イベント登録（詳細画面用）
  var detailEvents = [
    'app.record.detail.show',
    'app.record.create.show',
    'app.record.edit.show'
  ];

  kintone.events.on(detailEvents, function(event) {
    var spaceEl = kintone.app.record.getSpaceElement(DISPLAY_SPACE);
    if (!spaceEl) {
      return event;
    }

    addStyles();

    var currentStatus = event.record[STATUS_FIELD].value;
    var progressBar = createProgressBar(currentStatus);

    // 既存のコンテンツをクリア
    spaceEl.textContent = '';
    spaceEl.appendChild(progressBar);

    return event;
  });

})();
