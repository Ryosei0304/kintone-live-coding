/**
 * パターン: 自動採番
 * 説明: レコード保存時に独自フォーマットで自動採番する
 *
 * パラメータ:
 *   {{TARGET_FIELD}} - 採番結果を格納するフィールドコード
 *   {{PREFIX}} - 接頭辞（例: "INV-", "ORD-"）
 *   {{DIGITS}} - 連番の桁数（例: 4 → "0001"）
 *   {{DATE_FORMAT}} - 日付フォーマット（例: "YYYYMM", "YYYY" または空文字）
 */
(function() {
  'use strict';

  // 設定
  var TARGET_FIELD = '{{TARGET_FIELD}}';
  var PREFIX = '{{PREFIX}}';
  var DIGITS = {{DIGITS}};
  var DATE_FORMAT = '{{DATE_FORMAT}}';

  /**
   * 日付フォーマットを生成
   * @returns {string} - フォーマットされた日付文字列
   */
  function getDateString() {
    if (!DATE_FORMAT) {
      return '';
    }
    var now = new Date();
    var year = now.getFullYear();
    var month = ('0' + (now.getMonth() + 1)).slice(-2);
    var day = ('0' + now.getDate()).slice(-2);

    return DATE_FORMAT
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day);
  }

  /**
   * ゼロ埋めした連番を生成
   * @param {number} num - 数値
   * @returns {string} - ゼロ埋めした文字列
   */
  function padNumber(num) {
    return ('0'.repeat(DIGITS) + num).slice(-DIGITS);
  }

  /**
   * 最大の連番を取得
   * @param {string} dateStr - 日付文字列
   * @returns {Promise<number>} - 最大連番
   */
  function getMaxNumber(dateStr) {
    var query = TARGET_FIELD + ' like "' + PREFIX + dateStr + '"';
    var params = {
      app: kintone.app.getId(),
      query: query + ' order by ' + TARGET_FIELD + ' desc limit 1',
      fields: [TARGET_FIELD]
    };

    return kintone.api(kintone.api.url('/k/v1/records', true), 'GET', params)
      .then(function(resp) {
        if (resp.records.length === 0) {
          return 0;
        }
        var lastNumber = resp.records[0][TARGET_FIELD].value;
        var numberPart = lastNumber.replace(PREFIX + dateStr, '');
        return parseInt(numberPart, 10) || 0;
      });
  }

  // イベント登録
  kintone.events.on('app.record.create.submit', function(event) {
    var record = event.record;

    // 既に値がある場合はスキップ
    if (record[TARGET_FIELD].value) {
      return event;
    }

    var dateStr = getDateString();

    return getMaxNumber(dateStr).then(function(maxNum) {
      var newNumber = PREFIX + dateStr + padNumber(maxNum + 1);
      record[TARGET_FIELD].value = newNumber;
      return event;
    });
  });

})();
