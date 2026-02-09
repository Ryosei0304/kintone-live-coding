/**
 * パターン: 条件付き必須チェック
 * 説明: 特定の条件で必須チェックを行う
 *
 * パラメータ:
 *   {{CONDITION_FIELD}} - 条件となるフィールドコード
 *   {{CONDITION_VALUE}} - 条件となる値
 *   {{REQUIRED_FIELDS}} - 必須チェック対象フィールドの配列（JSON形式）
 *     [
 *       {"field": "field_code1", "label": "フィールド名1"},
 *       {"field": "field_code2", "label": "フィールド名2"}
 *     ]
 *   {{ERROR_MESSAGE_TEMPLATE}} - エラーメッセージテンプレート（{label}が置換される）
 */
(function() {
  'use strict';

  // 設定
  var CONDITION_FIELD = '{{CONDITION_FIELD}}';
  var CONDITION_VALUE = '{{CONDITION_VALUE}}';
  var REQUIRED_FIELDS = {{REQUIRED_FIELDS}};
  var ERROR_MESSAGE_TEMPLATE = '{{ERROR_MESSAGE_TEMPLATE}}';

  /**
   * 値が空かどうかをチェック
   * @param {*} value - チェック対象の値
   * @returns {boolean} - 空の場合true
   */
  function isEmpty(value) {
    if (value === null || value === undefined) {
      return true;
    }
    if (typeof value === 'string' && value.trim() === '') {
      return true;
    }
    if (Array.isArray(value) && value.length === 0) {
      return true;
    }
    return false;
  }

  /**
   * 条件付き必須チェックを実行
   * @param {Object} record - kintoneレコード
   * @returns {string|null} - エラーメッセージまたはnull
   */
  function validateRequired(record) {
    // 条件フィールドの値をチェック
    var conditionValue = record[CONDITION_FIELD].value;

    // 条件に一致しない場合はチェックをスキップ
    if (conditionValue !== CONDITION_VALUE) {
      return null;
    }

    // 必須フィールドをチェック
    var errors = [];
    REQUIRED_FIELDS.forEach(function(fieldConfig) {
      var fieldValue = record[fieldConfig.field].value;

      if (isEmpty(fieldValue)) {
        var errorMessage = ERROR_MESSAGE_TEMPLATE.replace('{label}', fieldConfig.label);
        errors.push(errorMessage);
      }
    });

    if (errors.length > 0) {
      return errors.join('\n');
    }
    return null;
  }

  // イベント登録
  var events = [
    'app.record.create.submit',
    'app.record.edit.submit'
  ];

  kintone.events.on(events, function(event) {
    var error = validateRequired(event.record);

    if (error) {
      event.error = error;
    }

    return event;
  });

})();
