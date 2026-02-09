#!/usr/bin/env python3
"""
依存グラフ構築とトポロジカルソート

Usage:
    # フィールド定義JSONから依存グラフを構築してソート順を出力
    python dependency_graph.py --input field_design.json

    # 循環参照チェックのみ
    python dependency_graph.py --input field_design.json --check-only

    # 詳細出力
    python dependency_graph.py --input field_design.json --verbose
"""

import argparse
import json
import sys
from graphlib import CycleError, TopologicalSorter
from typing import Dict, List, Set, Tuple


def node_id(app_id: str, field_code: str) -> str:
    """依存グラフのノードIDを生成"""
    return f"{app_id}.{field_code}"


def parse_node_id(node: str) -> Tuple[str, str]:
    """ノードIDをapp_idとfield_codeに分解"""
    parts = node.split(".", 1)
    return parts[0], parts[1] if len(parts) > 1 else ""


def build_dependency_graph(app_props: Dict[str, Dict[str, dict]]) -> Dict[str, Set[str]]:
    """
    フィールド間の依存グラフを構築

    Args:
        app_props: {app_id: {field_code: field_property}} の形式

    Returns:
        {node_id: {依存先node_id, ...}} の形式の依存グラフ
    """
    deps: Dict[str, Set[str]] = {}

    # 全ノードを登録
    for app_id, fields in app_props.items():
        if not isinstance(fields, dict):
            continue
        for code in fields.keys():
            deps.setdefault(node_id(app_id, code), set())

    # 依存関係を構築
    for app_id, fields in app_props.items():
        if not isinstance(fields, dict):
            continue

        for code, prop in fields.items():
            if not isinstance(prop, dict):
                continue

            ftype = prop.get("type", "")
            cur = node_id(app_id, code)

            # CALC は依存関係なし（計算フィールドは後から式を設定）
            if ftype == "CALC":
                continue

            # LOOKUP依存
            lookup = prop.get("lookup") or {}
            if isinstance(lookup, dict) and lookup:
                rel_app = lookup.get("relatedApp") or {}
                target_app = str(
                    rel_app.get("app") or rel_app.get("appCode") or rel_app.get("id") or ""
                ).strip()

                if target_app:
                    # relatedKeyField への依存
                    key_field = lookup.get("relatedKeyField")
                    if key_field:
                        # 自己依存を回避
                        if not (target_app == app_id and key_field == code):
                            target = node_id(target_app, key_field)
                            deps[cur].add(target)
                            deps.setdefault(target, set())

                    # fieldMappings への依存
                    for mapping in lookup.get("fieldMappings") or []:
                        rel_field = mapping.get("relatedField") or mapping.get("relatedFieldCode")
                        if rel_field:
                            if not (target_app == app_id and rel_field == code):
                                target = node_id(target_app, rel_field)
                                deps[cur].add(target)
                                deps.setdefault(target, set())

            # REFERENCE_TABLE依存
            ref = prop.get("referenceTable") or {}
            if ftype == "REFERENCE_TABLE" or (isinstance(ref, dict) and ref):
                rel_app = ref.get("relatedApp") or {}
                target_app = str(
                    rel_app.get("app") or rel_app.get("appCode") or rel_app.get("id") or ""
                ).strip()

                if target_app:
                    # 自アプリ側の条件フィールド
                    condition = ref.get("condition") or {}
                    local_field = condition.get("field") or condition.get("fieldCode")
                    if local_field and local_field != code:
                        local_target = node_id(app_id, local_field)
                        if local_target in deps:
                            deps[cur].add(local_target)

                    # 相手アプリ側の条件フィールド
                    rel_field = condition.get("relatedField") or condition.get("relatedFieldCode")
                    if rel_field:
                        if not (target_app == app_id and rel_field == code):
                            target = node_id(target_app, rel_field)
                            deps[cur].add(target)
                            deps.setdefault(target, set())

                    # displayFields への依存
                    display_fields = ref.get("displayFields") or []
                    for disp_field in display_fields:
                        if disp_field:
                            if not (target_app == app_id and disp_field == code):
                                target = node_id(target_app, disp_field)
                                deps[cur].add(target)
                                deps.setdefault(target, set())

    return deps


def build_app_dependency_graph(app_props: Dict[str, Dict[str, dict]]) -> Dict[str, Set[str]]:
    """
    アプリレベルの依存グラフを構築

    LOOKUP: 依存なし（relatedKeyFieldは基本フィールド）
    REFERENCE_TABLE: condition.relatedFieldがPass2フィールドの場合のみ依存
    """
    # Pass2フィールド（LOOKUP/REFERENCE_TABLE）を特定
    pass2_fields_by_app: Dict[str, Set[str]] = {}
    for app_id, fields in app_props.items():
        if not isinstance(fields, dict):
            continue
        pass2 = set()
        for code, prop in fields.items():
            if not isinstance(prop, dict):
                continue
            if prop.get("lookup") or prop.get("type") == "REFERENCE_TABLE":
                pass2.add(code)
        pass2_fields_by_app[str(app_id)] = pass2

    deps: Dict[str, Set[str]] = {str(app_id): set() for app_id in app_props.keys()}

    for app_id, fields in app_props.items():
        if not isinstance(fields, dict):
            continue

        for _, prop in fields.items():
            if not isinstance(prop, dict):
                continue

            # REFERENCE_TABLEのみチェック
            ref = prop.get("referenceTable") or {}
            if isinstance(ref, dict) and ref:
                rel_app = ref.get("relatedApp") or {}
                target_app = str(rel_app.get("app") or "").strip()
                if target_app:
                    deps.setdefault(target_app, set())

                    # condition.relatedFieldがPass2フィールドかチェック
                    condition = ref.get("condition") or {}
                    related_field = str(condition.get("relatedField") or "").strip()
                    if related_field and related_field in pass2_fields_by_app.get(target_app, set()):
                        deps.setdefault(str(app_id), set()).add(target_app)

    return deps


def topo_sort_with_cycle_check(deps: Dict[str, Set[str]]) -> List[str]:
    """トポロジカルソートを実行（循環検出付き）"""
    sorter = TopologicalSorter(deps)
    try:
        return list(sorter.static_order())
    except CycleError as e:
        cycle_nodes = [str(n) for n in e.args[1]] if len(e.args) > 1 else []
        raise RuntimeError(f"循環参照が検出されました: {' -> '.join(cycle_nodes)}")


def separate_base_and_relation_fields(
    app_props: Dict[str, Dict[str, dict]]
) -> Tuple[Dict[str, Dict[str, dict]], Dict[str, Dict[str, dict]]]:
    """
    フィールドを基本フィールドと連携フィールドに分離

    Returns:
        (base_props, relation_props)
    """
    base_props: Dict[str, Dict[str, dict]] = {}
    relation_props: Dict[str, Dict[str, dict]] = {}

    for app_id, fields in app_props.items():
        if not isinstance(fields, dict):
            continue

        for code, prop in fields.items():
            if not isinstance(prop, dict):
                continue

            has_lookup = bool(prop.get("lookup"))
            has_ref_table = prop.get("type") == "REFERENCE_TABLE" or bool(prop.get("referenceTable"))

            if has_lookup or has_ref_table:
                relation_props.setdefault(app_id, {})[code] = prop
            else:
                base_props.setdefault(app_id, {})[code] = prop

    return base_props, relation_props


def get_creation_order(app_props: Dict[str, Dict[str, dict]], verbose: bool = False) -> Dict:
    """
    フィールド作成順序を決定

    Returns:
        {
            "pass1": {app_id: [field_codes]},  # 基本フィールド
            "pass2": [(app_id, field_code), ...]  # 連携フィールド（トポロジカル順）
        }
    """
    base_props, relation_props = separate_base_and_relation_fields(app_props)

    # Pass1: 基本フィールド（アプリごとにまとめて作成可能）
    pass1 = {app_id: list(fields.keys()) for app_id, fields in base_props.items()}

    # Pass2: 連携フィールド（依存順に作成）
    if relation_props:
        deps = build_dependency_graph(relation_props)
        sorted_nodes = topo_sort_with_cycle_check(deps)

        # 連携フィールドのみ抽出
        pass2 = []
        for node in sorted_nodes:
            app_id, field_code = parse_node_id(node)
            if app_id in relation_props and field_code in relation_props.get(app_id, {}):
                pass2.append({"app_id": app_id, "field_code": field_code})

        if verbose:
            print(f"依存グラフのノード数: {len(deps)}", file=sys.stderr)
            print(f"連携フィールド数: {len(pass2)}", file=sys.stderr)
    else:
        pass2 = []

    return {"pass1": pass1, "pass2": pass2}


def main():
    parser = argparse.ArgumentParser(description="依存グラフ構築とトポロジカルソート")
    parser.add_argument("--input", "-i", required=True, help="フィールド定義JSONファイル")
    parser.add_argument("--check-only", action="store_true", help="循環参照チェックのみ")
    parser.add_argument("--verbose", "-v", action="store_true", help="詳細出力")
    parser.add_argument("--app-level", action="store_true", help="アプリレベルの依存グラフを出力")

    args = parser.parse_args()

    # JSONを読み込み
    with open(args.input, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 形式を判定して変換
    # 形式1: {"apps": [{"app_id": "...", "fields": {...}}, ...]}
    # 形式2: {"app_id": {"field_code": {...}, ...}}
    if "apps" in data and isinstance(data["apps"], list):
        app_props = {}
        for app in data["apps"]:
            app_id = str(app.get("app_id") or app.get("id") or "")
            fields = app.get("fields") or app.get("properties") or {}
            if app_id and fields:
                app_props[app_id] = fields
    else:
        app_props = data

    try:
        if args.app_level:
            # アプリレベルの依存グラフ
            deps = build_app_dependency_graph(app_props)
            sorted_apps = topo_sort_with_cycle_check(deps)
            result = {
                "app_order": sorted_apps,
                "dependencies": {k: list(v) for k, v in deps.items()},
            }
        elif args.check_only:
            # 循環チェックのみ
            deps = build_dependency_graph(app_props)
            topo_sort_with_cycle_check(deps)
            result = {"success": True, "message": "循環参照なし", "node_count": len(deps)}
        else:
            # 作成順序を決定
            result = get_creation_order(app_props, verbose=args.verbose)

        print(json.dumps(result, ensure_ascii=False, indent=2))

    except RuntimeError as e:
        print(json.dumps({"success": False, "error": str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
