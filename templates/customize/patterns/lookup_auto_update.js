/**
 * パターン: ルックアップ自動更新
 * 説明: ルックアップ元データ更新時に自動で最新情報を取得して更新
 *
 * パラメータ:
 *   {{LOOKUP_FIELD}} - ルックアップフィールドコード
 *   {{SOURCE_APP_ID}} - ルックアップ元アプリID
 *   {{KEY_FIELD}} - キーとなるフィールドコード（参照元）
 *   {{COPY_FIELDS}} - コピーするフィールドのマッピング（JSON形式）
 *     [
 *       {"source": "source_field_code", "target": "target_field_code"}
 *     ]
 */
(function() {
  'use strict';

  // 設定
  var LOOKUP_FIELD = '{{LOOKUP_FIELD}}';
  var SOURCE_APP_ID = '{{SOURCE_APP_ID}}';
  var KEY_FIELD = '{{KEY_FIELD}}';
  var COPY_FIELDS = {{COPY_FIELDS}};

  /**
   * ルックアップ元から最新データを取得
   * @param {string} keyValue - キー値
   * @returns {Promise<Object|null>} - レコードまたはnull
   */
  function fetchSourceRecord(keyValue) {
    var params = {
      app: SOURCE_APP_ID,
      query: KEY_FIELD + ' = "' + keyValue + '" limit 1'
    };

    return kintone.api(kintone.api.url('/k/v1/records', true), 'GET', params)
      .then(function(resp) {
        if (resp.records.length === 0) {
          return null;
        }
        return resp.records[0];
      });
  }

  /**
   * ルックアップデータを更新
   * @param {Object} record - kintoneレコード
   * @returns {Promise<void>}
   */
  function updateLookupData(record) {
    var lookupValue = record[LOOKUP_FIELD].value;

    if (!lookupValue) {
      return Promise.resolve();
    }

    return fetchSourceRecord(lookupValue).then(function(sourceRecord) {
      if (!sourceRecord) {
        return;
      }

      // フィールドをコピー
      COPY_FIELDS.forEach(function(mapping) {
        if (sourceRecord[mapping.source]) {
          record[mapping.target].value = sourceRecord[mapping.source].value;
        }
      });
    });
  }

  // イベント登録（画面表示時に自動更新）
  var showEvents = [
    'app.record.edit.show'
  ];

  kintone.events.on(showEvents, function(event) {
    return updateLookupData(event.record).then(function() {
      return event;
    });
  });

  // イベント登録（ルックアップ変更時）
  var changeEvents = [
    'app.record.create.change.' + LOOKUP_FIELD,
    'app.record.edit.change.' + LOOKUP_FIELD
  ];

  kintone.events.on(changeEvents, function(event) {
    return updateLookupData(event.record).then(function() {
      return event;
    });
  });

})();
