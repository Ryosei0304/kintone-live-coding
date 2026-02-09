/**
 * パターン: 経過年数/日数表示
 * 説明: 基準日からの経過年数・月数・日数をリアルタイム表示する
 *
 * パラメータ:
 *   {{DATE_FIELD}} - 基準日フィールドコード
 *   {{DISPLAY_SPACE}} - 表示用スペースの要素ID
 *   {{FORMAT}} - 表示フォーマット（"years" | "months" | "days" | "full"）
 *   {{LABEL}} - 表示ラベル（例: "勤続期間"）
 */
(function() {
  'use strict';

  // 設定
  var DATE_FIELD = '{{DATE_FIELD}}';
  var DISPLAY_SPACE = '{{DISPLAY_SPACE}}';
  var FORMAT = '{{FORMAT}}';
  var LABEL = '{{LABEL}}';

  /**
   * 経過期間を計算
   * @param {Date} startDate - 基準日
   * @returns {Object} - {years, months, days}
   */
  function calculateElapsed(startDate) {
    var now = new Date();
    var years = now.getFullYear() - startDate.getFullYear();
    var months = now.getMonth() - startDate.getMonth();
    var days = now.getDate() - startDate.getDate();

    // 日数が負の場合、月を調整
    if (days < 0) {
      months--;
      var lastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      days += lastMonth.getDate();
    }

    // 月数が負の場合、年を調整
    if (months < 0) {
      years--;
      months += 12;
    }

    // 総日数を計算
    var totalDays = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
    var totalMonths = years * 12 + months;

    return {
      years: years,
      months: months,
      days: days,
      totalDays: totalDays,
      totalMonths: totalMonths
    };
  }

  /**
   * 表示テキストをフォーマット
   * @param {Object} elapsed - 経過期間オブジェクト
   * @returns {string}
   */
  function formatDisplay(elapsed) {
    switch (FORMAT) {
      case 'years':
        return elapsed.years + '年';
      case 'months':
        return elapsed.totalMonths + 'ヶ月';
      case 'days':
        return elapsed.totalDays + '日';
      case 'full':
      default:
        var parts = [];
        if (elapsed.years > 0) {
          parts.push(elapsed.years + '年');
        }
        if (elapsed.months > 0) {
          parts.push(elapsed.months + 'ヶ月');
        }
        if (elapsed.days > 0 || parts.length === 0) {
          parts.push(elapsed.days + '日');
        }
        return parts.join(' ');
    }
  }

  /**
   * 経過期間を表示
   * @param {Object} record - kintoneレコード
   */
  function displayElapsed(record) {
    var spaceEl = kintone.app.record.getSpaceElement(DISPLAY_SPACE);
    if (!spaceEl) {
      return;
    }

    var dateValue = record[DATE_FIELD].value;

    // クリア
    spaceEl.textContent = '';

    if (!dateValue) {
      return;
    }

    var startDate = new Date(dateValue);
    var elapsed = calculateElapsed(startDate);
    var displayText = formatDisplay(elapsed);

    // 表示要素を作成
    var container = document.createElement('div');
    container.className = 'elapsed-display';

    if (LABEL) {
      var labelEl = document.createElement('span');
      labelEl.className = 'elapsed-label';
      labelEl.textContent = LABEL + ': ';
      container.appendChild(labelEl);
    }

    var valueEl = document.createElement('span');
    valueEl.className = 'elapsed-value';
    valueEl.textContent = displayText;
    container.appendChild(valueEl);

    spaceEl.appendChild(container);
  }

  /**
   * スタイルを追加
   */
  function addStyles() {
    var styleId = 'elapsed-years-styles';
    if (document.getElementById(styleId)) {
      return;
    }

    var style = document.createElement('style');
    style.id = styleId;
    style.textContent = [
      '.elapsed-display { font-size: 14px; padding: 4px 0; }',
      '.elapsed-label { color: #666; }',
      '.elapsed-value { font-weight: bold; color: #333; }'
    ].join('\n');
    document.head.appendChild(style);
  }

  // イベント登録
  var events = [
    'app.record.detail.show',
    'app.record.create.show',
    'app.record.edit.show'
  ];

  kintone.events.on(events, function(event) {
    addStyles();
    displayElapsed(event.record);
    return event;
  });

  // 値変更時も更新
  var changeEvents = [
    'app.record.create.change.' + DATE_FIELD,
    'app.record.edit.change.' + DATE_FIELD
  ];

  kintone.events.on(changeEvents, function(event) {
    displayElapsed(event.record);
    return event;
  });

})();
