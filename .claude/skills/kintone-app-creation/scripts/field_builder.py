#!/usr/bin/env python3
"""
フィールド設計書からkintone APIプロパティへの変換

Usage:
    # マークダウンのフィールド設計書を読み込んでJSONに変換
    python field_builder.py --input フィールド設計書.md --output fields.json

    # JSON形式のフィールド設計書を正規化
    python field_builder.py --input field_design.json --output fields.json --format json

    # バリデーションのみ
    python field_builder.py --input fields.json --validate-only
"""

import argparse
import json
import re
import sys
import unicodedata
from typing import Any, Dict, List, Optional, Tuple


# フィールドタイプのマッピング（日本語 → kintone API）
FIELD_TYPE_MAP = {
    # テキスト
    "文字列(1行)": "SINGLE_LINE_TEXT",
    "文字列（1行）": "SINGLE_LINE_TEXT",
    "文字列(複数行)": "MULTI_LINE_TEXT",
    "文字列（複数行）": "MULTI_LINE_TEXT",
    "リッチエディター": "RICH_TEXT",
    "リッチエディタ": "RICH_TEXT",
    # 数値
    "数値": "NUMBER",
    # 日時
    "日付": "DATE",
    "日時": "DATETIME",
    "時刻": "TIME",
    # 選択肢
    "ドロップダウン": "DROP_DOWN",
    "ラジオボタン": "RADIO_BUTTON",
    "ラジオ選択": "RADIO_BUTTON",
    "チェックボックス": "CHECK_BOX",
    "複数選択": "MULTI_SELECT",
    # ユーザー/組織
    "ユーザー選択": "USER_SELECT",
    "組織選択": "ORGANIZATION_SELECT",
    "グループ選択": "GROUP_SELECT",
    # その他
    "添付ファイル": "FILE",
    "リンク": "LINK",
    "テーブル": "SUBTABLE",
    "グループ": "GROUP",
    # 連携
    "ルックアップ": "LOOKUP",
    "関連レコード一覧": "REFERENCE_TABLE",
    # 計算
    "計算": "CALC",
}

# 選択肢が必要なフィールドタイプ
SELECTION_FIELD_TYPES = {"DROP_DOWN", "RADIO_BUTTON", "CHECK_BOX", "MULTI_SELECT"}

# サブテーブル内で使用不可のフィールドタイプ
FORBIDDEN_IN_SUBTABLE = {"LOOKUP", "REFERENCE_TABLE", "SUBTABLE", "GROUP"}


def normalize_field_type(field_type: str) -> str:
    """フィールドタイプを正規化"""
    if not field_type:
        return ""

    # NFKC正規化
    normalized = unicodedata.normalize("NFKC", field_type.strip())

    # 既に大文字アンダースコア形式ならそのまま
    if re.fullmatch(r"[A-Z_]+", normalized):
        return normalized

    # マッピングから検索
    return FIELD_TYPE_MAP.get(normalized, normalized)


def normalize_field_code(code: str) -> str:
    """フィールドコードを正規化"""
    if not code:
        return ""

    # NFKC正規化
    normalized = unicodedata.normalize("NFKC", str(code).strip())

    # 許可する記号
    allowed_symbols = {"_", "・", "＄", "￥", "¥"}

    # 文字を処理
    cleaned = []
    for ch in normalized:
        if ch.isspace():
            cleaned.append("_")
        elif ch in allowed_symbols:
            cleaned.append(ch)
        elif unicodedata.category(ch)[0] in {"L", "N"}:  # 文字/数字
            cleaned.append(ch)
        else:
            cleaned.append("_")

    result = "".join(cleaned)
    result = re.sub(r"_+", "_", result).strip("_")

    if not result:
        result = "field"

    # 数字で始まる場合はプレフィックスを追加
    if re.match(r"^\d", result):
        result = f"f_{result}"

    return result


def parse_options(options_str: str) -> Dict[str, Dict[str, str]]:
    """選択肢文字列をパース"""
    if not options_str:
        return {}

    options = {}
    # カンマ、改行、スラッシュで分割
    items = re.split(r"[,、\n/／]", options_str)

    for i, item in enumerate(items):
        item = item.strip()
        if item:
            options[item] = {"label": item, "index": str(i)}

    return options


def build_field_property(
    field_name: str,
    field_code: str,
    field_type: str,
    description: str = "",
    options: str = "",
    required: bool = False,
    lookup_config: Optional[Dict] = None,
    reference_table_config: Optional[Dict] = None,
) -> Dict[str, Any]:
    """フィールドプロパティを構築"""
    normalized_type = normalize_field_type(field_type)
    normalized_code = normalize_field_code(field_code) if field_code else normalize_field_code(field_name)

    prop: Dict[str, Any] = {
        "type": normalized_type,
        "code": normalized_code,
        "label": field_name,
        "noLabel": False,
        "required": required,
    }

    # 選択肢フィールド
    if normalized_type in SELECTION_FIELD_TYPES:
        parsed_options = parse_options(options)
        if parsed_options:
            prop["options"] = parsed_options

    # リンクフィールド
    if normalized_type == "LINK":
        # デフォルトはWEB
        prop["protocol"] = "WEB"
        if description:
            desc_lower = description.lower()
            if "メール" in description or "mail" in desc_lower:
                prop["protocol"] = "MAIL"
            elif "電話" in description or "tel" in desc_lower or "call" in desc_lower:
                prop["protocol"] = "CALL"

    # ルックアップ
    if normalized_type == "LOOKUP" or lookup_config:
        # ルックアップは基底タイプを設定（デフォルトSINGLE_LINE_TEXT）
        prop["type"] = "SINGLE_LINE_TEXT"
        if lookup_config:
            prop["lookup"] = lookup_config

    # 関連レコード一覧
    if normalized_type == "REFERENCE_TABLE" or reference_table_config:
        prop["type"] = "REFERENCE_TABLE"
        if reference_table_config:
            prop["referenceTable"] = reference_table_config

    return prop


def parse_markdown_table(content: str) -> List[Dict[str, str]]:
    """マークダウンテーブルをパース"""
    rows = []
    lines = content.strip().split("\n")

    header = None
    for line in lines:
        line = line.strip()
        if not line or line.startswith("---") or re.match(r"^\|[\s-:|]+\|$", line):
            continue

        if line.startswith("|"):
            cells = [c.strip() for c in line.split("|")[1:-1]]

            if header is None:
                header = cells
            else:
                row = {}
                for i, cell in enumerate(cells):
                    if i < len(header):
                        row[header[i]] = cell
                rows.append(row)

    return rows


def extract_app_fields_from_markdown(content: str) -> Dict[str, Dict[str, dict]]:
    """マークダウンからアプリごとのフィールドを抽出"""
    app_props: Dict[str, Dict[str, dict]] = {}

    # アプリセクションを検出（### アプリ名 形式）
    sections = re.split(r"^###\s+", content, flags=re.MULTILINE)

    for section in sections[1:]:  # 最初の空セクションをスキップ
        lines = section.strip().split("\n")
        if not lines:
            continue

        app_name = lines[0].strip()
        section_content = "\n".join(lines[1:])

        # テーブルを検索
        table_match = re.search(r"\|[^|]+\|.*(?:\n\|[^|]+\|.*)*", section_content)
        if table_match:
            rows = parse_markdown_table(table_match.group())

            fields = {}
            for row in rows:
                field_name = row.get("フィールド名", "")
                field_code = row.get("フィールドコード", field_name)
                field_type = row.get("フィールドタイプ", "")
                description = row.get("説明", "")
                notes = row.get("備考", "")

                if field_name and field_type:
                    prop = build_field_property(
                        field_name=field_name,
                        field_code=field_code,
                        field_type=field_type,
                        description=description,
                        options=notes if normalize_field_type(field_type) in SELECTION_FIELD_TYPES else "",
                    )
                    fields[prop["code"]] = prop

            if fields:
                app_props[app_name] = fields

    return app_props


def validate_fields(app_props: Dict[str, Dict[str, dict]]) -> List[Dict[str, str]]:
    """フィールド定義をバリデーション"""
    errors = []

    for app_id, fields in app_props.items():
        if not isinstance(fields, dict):
            continue

        for code, prop in fields.items():
            if not isinstance(prop, dict):
                continue

            field_type = prop.get("type", "")

            # 選択肢フィールドにoptionsがない
            if field_type in SELECTION_FIELD_TYPES:
                if not prop.get("options"):
                    errors.append({
                        "app_id": app_id,
                        "field_code": code,
                        "error": f"{field_type}フィールドにoptionsがありません",
                    })

            # LINKフィールドにprotocolがない
            if field_type == "LINK":
                if not prop.get("protocol"):
                    errors.append({
                        "app_id": app_id,
                        "field_code": code,
                        "error": "LINKフィールドにprotocolがありません",
                    })

            # REFERENCE_TABLEにreferenceTableがない
            if field_type == "REFERENCE_TABLE":
                if not prop.get("referenceTable"):
                    errors.append({
                        "app_id": app_id,
                        "field_code": code,
                        "error": "REFERENCE_TABLEフィールドにreferenceTable設定がありません",
                    })

            # lookupがあるがlookup設定がない
            if prop.get("lookup") and not isinstance(prop.get("lookup"), dict):
                errors.append({
                    "app_id": app_id,
                    "field_code": code,
                    "error": "lookupフィールドにlookup設定がありません",
                })

    return errors


def main():
    parser = argparse.ArgumentParser(description="フィールド設計書からkintone APIプロパティへの変換")
    parser.add_argument("--input", "-i", required=True, help="入力ファイル")
    parser.add_argument("--output", "-o", help="出力ファイル（省略時は標準出力）")
    parser.add_argument("--format", "-f", choices=["md", "json"], default="md", help="入力形式")
    parser.add_argument("--validate-only", action="store_true", help="バリデーションのみ")

    args = parser.parse_args()

    # ファイル読み込み
    with open(args.input, "r", encoding="utf-8") as f:
        content = f.read()

    # 形式に応じてパース
    if args.format == "json" or args.input.endswith(".json"):
        data = json.loads(content)
        # 形式を判定
        if "apps" in data and isinstance(data["apps"], list):
            app_props = {}
            for app in data["apps"]:
                app_id = str(app.get("app_id") or app.get("id") or app.get("app_name", ""))
                fields = app.get("fields") or app.get("properties") or {}
                if app_id and fields:
                    app_props[app_id] = fields
        else:
            app_props = data
    else:
        app_props = extract_app_fields_from_markdown(content)

    # バリデーション
    errors = validate_fields(app_props)

    if args.validate_only:
        if errors:
            print(json.dumps({"valid": False, "errors": errors}, ensure_ascii=False, indent=2))
            sys.exit(1)
        else:
            print(json.dumps({"valid": True, "app_count": len(app_props)}, ensure_ascii=False))
            sys.exit(0)

    # エラーがあっても出力（警告として表示）
    if errors:
        print(f"警告: {len(errors)}件のバリデーションエラー", file=sys.stderr)
        for err in errors:
            print(f"  - {err['app_id']}.{err['field_code']}: {err['error']}", file=sys.stderr)

    # 出力
    result = {"apps": [{"app_id": app_id, "fields": fields} for app_id, fields in app_props.items()]}

    output = json.dumps(result, ensure_ascii=False, indent=2)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output)
        print(f"出力: {args.output}", file=sys.stderr)
    else:
        print(output)


if __name__ == "__main__":
    main()
