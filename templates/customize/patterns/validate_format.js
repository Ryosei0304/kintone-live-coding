/**
 * パターン: 入力フォーマットチェック
 * 説明: 郵便番号/電話番号/メールアドレスの形式をチェック
 *
 * パラメータ:
 *   {{VALIDATIONS}} - バリデーション設定の配列（JSON形式）
 *     [
 *       {"field": "postal_code", "label": "郵便番号", "type": "postal"},
 *       {"field": "tel", "label": "電話番号", "type": "tel"},
 *       {"field": "email", "label": "メールアドレス", "type": "email"}
 *     ]
 *   type: "postal" | "tel" | "email" | "custom"
 *   customPattern: 正規表現パターン（type: "custom"の場合）
 */
(function() {
  'use strict';

  // 設定
  var VALIDATIONS = {{VALIDATIONS}};

  // バリデーションパターン
  var PATTERNS = {
    // 郵便番号: ハイフンあり/なし両対応
    postal: /^[0-9]{3}-?[0-9]{4}$/,
    // 電話番号: ハイフンあり/なし両対応、市外局番対応
    tel: /^0[0-9]{1,4}-?[0-9]{1,4}-?[0-9]{3,4}$/,
    // メールアドレス
    email: /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
  };

  // エラーメッセージ
  var ERROR_MESSAGES = {
    postal: '{label}の形式が正しくありません（例: 123-4567）',
    tel: '{label}の形式が正しくありません（例: 03-1234-5678）',
    email: '{label}の形式が正しくありません（例: example@domain.com）',
    custom: '{label}の形式が正しくありません'
  };

  /**
   * フォーマットをチェック
   * @param {Object} record - kintoneレコード
   * @returns {string|null} - エラーメッセージまたはnull
   */
  function validateFormats(record) {
    var errors = [];

    VALIDATIONS.forEach(function(config) {
      var value = record[config.field].value;

      // 空値はスキップ（必須チェックは別パターンで行う）
      if (!value || value.trim() === '') {
        return;
      }

      var pattern;
      if (config.type === 'custom' && config.customPattern) {
        pattern = new RegExp(config.customPattern);
      } else {
        pattern = PATTERNS[config.type];
      }

      if (pattern && !pattern.test(value)) {
        var message = ERROR_MESSAGES[config.type] || ERROR_MESSAGES.custom;
        errors.push(message.replace('{label}', config.label));
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
    var error = validateFormats(event.record);

    if (error) {
      event.error = error;
    }

    return event;
  });

})();
