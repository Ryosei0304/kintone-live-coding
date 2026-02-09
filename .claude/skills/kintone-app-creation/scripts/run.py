#!/usr/bin/env python3
"""
kintoneアプリ作成 - メイン実行スクリプト

Usage:
    # 対話モード
    python run.py

    # 設計書を指定して実行
    python run.py --app-design アプリ設計書.md --field-design フィールド設計書.md

    # 認証情報を指定
    python run.py --subdomain mycompany --user user@example.com --password xxx \
                  --app-design アプリ設計書.md --field-design フィールド設計書.md

    # ドライラン（実際には作成しない）
    python run.py --dry-run --field-design フィールド設計書.md
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# 同じディレクトリのモジュールをインポート
script_dir = Path(__file__).parent
sys.path.insert(0, str(script_dir))

from kintone_client import KintoneClient, APIError
from dependency_graph import get_creation_order, build_dependency_graph, topo_sort_with_cycle_check
from field_builder import extract_app_fields_from_markdown, validate_fields


def load_credentials() -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """認証情報を環境変数から読み込み"""
    return (
        os.environ.get("KINTONE_SUBDOMAIN"),
        os.environ.get("KINTONE_USER_ID"),
        os.environ.get("KINTONE_PASSWORD"),
    )


def prompt_credentials() -> Tuple[str, str, str]:
    """認証情報を対話形式で取得"""
    print("\nkintone認証情報を入力してください。\n")

    subdomain = input("サブドメイン（例: mycompany）: ").strip()
    user_id = input("ユーザーID: ").strip()

    # パスワードは非表示で入力
    import getpass
    password = getpass.getpass("パスワード: ")

    return subdomain, user_id, password


def prompt_space_settings() -> Tuple[str, str]:
    """スペース設定を対話形式で取得"""
    print("\nスペース設定を入力してください。\n")

    space_name = input("スペース名: ").strip()
    thread_name = input("スレッド名（空欄でスペース名と同じ）: ").strip()

    if not thread_name:
        thread_name = space_name

    return space_name, thread_name


def extract_apps_from_design(content: str) -> List[str]:
    """アプリ設計書からアプリ名を抽出"""
    import re

    apps = []

    # テーブル形式を検索
    # | アプリ名 | 説明 |
    table_match = re.search(r"\|[^|]*アプリ名[^|]*\|.*(?:\n\|[^|]+\|.*)*", content)
    if table_match:
        lines = table_match.group().strip().split("\n")
        for line in lines[2:]:  # ヘッダーと区切り行をスキップ
            if line.startswith("|"):
                cells = [c.strip() for c in line.split("|")[1:-1]]
                if cells and cells[0]:
                    apps.append(cells[0])

    return apps


def run_phase1(
    client: KintoneClient,
    space_name: str,
    thread_name: str,
    app_names: List[str],
    dry_run: bool = False,
) -> Dict[str, Any]:
    """Phase 1: スペース・アプリ作成"""
    print("\n[Phase 1] スペース・アプリ作成")

    result = {
        "space_id": None,
        "thread_id": None,
        "apps": {},  # {app_name: app_id}
    }

    if dry_run:
        print("  [DRY RUN] スペース作成をスキップ")
        result["space_id"] = "DRY_RUN_SPACE"
        result["thread_id"] = "DRY_RUN_THREAD"
        for i, name in enumerate(app_names):
            result["apps"][name] = f"DRY_RUN_APP_{i+1}"
        return result

    # 1. 認証検証
    print("  認証情報を検証中...")
    client.verify_credentials()
    print("  ✓ 認証成功")

    # 2. スペース作成
    print(f"  スペース「{space_name}」を作成中...")
    space_result = client.create_space(space_name)
    space_id = int(space_result["id"])
    result["space_id"] = space_id
    print(f"  ✓ スペース作成完了 (ID: {space_id})")

    # 3. マルチスレッド有効化
    print("  マルチスレッドを有効化中...")
    client.update_space(space_id, use_multi_thread=True)
    print("  ✓ マルチスレッド有効化完了")

    # 4. スレッド作成
    print(f"  スレッド「{thread_name}」を作成中...")
    thread_result = client.create_thread(space_id, thread_name)
    thread_id = int(thread_result["id"])
    result["thread_id"] = thread_id
    print(f"  ✓ スレッド作成完了 (ID: {thread_id})")

    # 5. アプリ作成
    print(f"  アプリを作成中... ({len(app_names)}個)")
    app_ids = []
    for name in app_names:
        app_result = client.create_app(name, space_id, thread_id)
        app_id = int(app_result["app"])
        result["apps"][name] = app_id
        app_ids.append(app_id)
        print(f"    - {name} (ID: {app_id})")

    # 6. デプロイ
    print("  本番環境にデプロイ中...")
    client.deploy(app_ids)
    deploy_result = client.check_deploy_status(app_ids)

    # 結果確認
    for app in deploy_result.get("apps", []):
        status = app.get("status")
        if status != "SUCCESS":
            print(f"    警告: アプリ {app.get('app')} のデプロイステータス: {status}", file=sys.stderr)

    print("  ✓ デプロイ完了")

    return result


def run_phase2(
    client: KintoneClient,
    app_props: Dict[str, Dict[str, dict]],
    app_name_to_id: Dict[str, int],
    dry_run: bool = False,
) -> Dict[str, Any]:
    """Phase 2: フィールド作成（優先度順に依存解決）"""
    print("\n[Phase 2] フィールド作成")

    # アプリ名をアプリIDに変換
    id_props: Dict[str, Dict[str, dict]] = {}
    for app_name, fields in app_props.items():
        if app_name in app_name_to_id:
            app_id = str(app_name_to_id[app_name])
            id_props[app_id] = fields
        else:
            print(f"  警告: アプリ「{app_name}」が見つかりません", file=sys.stderr)

    # 作成順序を決定
    print("  依存グラフを構築中...")
    try:
        order = get_creation_order(id_props, verbose=True)
    except RuntimeError as e:
        print(f"  エラー: {e}", file=sys.stderr)
        return {"error": str(e)}

    print("  ✓ 依存グラフ構築完了")

    result = {
        "pass1": {"created": 0, "apps": []},
        "pass2": {"created": 0, "fields": []},
    }

    if dry_run:
        print("  [DRY RUN] フィールド作成をスキップ")
        return result

    # Pass 1: 基本フィールド
    print("\n  [Pass 1] 基本フィールドを作成中...")
    for app_id, field_codes in order.get("pass1", {}).items():
        if not field_codes:
            continue

        fields_to_create = {code: id_props[app_id][code] for code in field_codes if code in id_props.get(app_id, {})}

        if fields_to_create:
            print(f"    アプリ {app_id}: {len(fields_to_create)}フィールド")
            client.add_fields(int(app_id), fields_to_create)
            result["pass1"]["created"] += len(fields_to_create)
            result["pass1"]["apps"].append(app_id)

    # Pass 1のデプロイ
    if result["pass1"]["apps"]:
        app_ids = [int(aid) for aid in result["pass1"]["apps"]]
        print("    デプロイ中...")
        client.deploy(app_ids)
        client.check_deploy_status(app_ids)
        print("  ✓ Pass 1 完了")

    # Pass 2: 連携フィールド（トポロジカル順）
    pass2_fields = order.get("pass2", [])
    if pass2_fields:
        print(f"\n  [Pass 2] 連携フィールドを作成中... ({len(pass2_fields)}フィールド)")

        # アプリごとにグループ化して作成
        current_app = None
        batch = {}
        affected_apps = set()

        for item in pass2_fields:
            app_id = item["app_id"]
            field_code = item["field_code"]

            if current_app != app_id and batch:
                # 前のアプリのバッチを処理
                print(f"    アプリ {current_app}: {len(batch)}フィールド")
                client.add_fields(int(current_app), batch)
                result["pass2"]["created"] += len(batch)
                affected_apps.add(current_app)
                batch = {}

            current_app = app_id
            if app_id in id_props and field_code in id_props[app_id]:
                batch[field_code] = id_props[app_id][field_code]

        # 最後のバッチを処理
        if batch and current_app:
            print(f"    アプリ {current_app}: {len(batch)}フィールド")
            client.add_fields(int(current_app), batch)
            result["pass2"]["created"] += len(batch)
            affected_apps.add(current_app)

        # Pass 2のデプロイ
        if affected_apps:
            app_ids = [int(aid) for aid in affected_apps]
            print("    デプロイ中...")
            client.deploy(app_ids)
            client.check_deploy_status(app_ids)

        print("  ✓ Pass 2 完了")

    return result


def main():
    parser = argparse.ArgumentParser(description="kintoneアプリ作成")
    parser.add_argument("--subdomain", help="kintoneサブドメイン")
    parser.add_argument("--user", help="ユーザーID")
    parser.add_argument("--password", help="パスワード")
    parser.add_argument("--space-name", help="スペース名")
    parser.add_argument("--thread-name", help="スレッド名")
    parser.add_argument("--app-design", help="アプリ設計書ファイル")
    parser.add_argument("--field-design", help="フィールド設計書ファイル")
    parser.add_argument("--dry-run", action="store_true", help="ドライラン（実際には作成しない）")
    parser.add_argument("--output", "-o", help="結果を出力するJSONファイル")

    args = parser.parse_args()

    print("=" * 50)
    print("kintoneアプリ作成AI")
    print("=" * 50)

    # 認証情報
    subdomain = args.subdomain
    user_id = args.user
    password = args.password

    if not subdomain or not user_id or not password:
        env_subdomain, env_user, env_password = load_credentials()
        subdomain = subdomain or env_subdomain
        user_id = user_id or env_user
        password = password or env_password

    if not subdomain or not user_id or not password:
        subdomain, user_id, password = prompt_credentials()

    # クライアント初期化
    client = KintoneClient(subdomain, user_id, password)

    # アプリ設計書
    app_names = []
    if args.app_design:
        with open(args.app_design, "r", encoding="utf-8") as f:
            content = f.read()
        app_names = extract_apps_from_design(content)
        print(f"\nアプリ設計書から{len(app_names)}個のアプリを検出:")
        for name in app_names:
            print(f"  - {name}")

    # フィールド設計書
    app_props = {}
    if args.field_design:
        with open(args.field_design, "r", encoding="utf-8") as f:
            content = f.read()

        if args.field_design.endswith(".json"):
            data = json.loads(content)
            if "apps" in data:
                for app in data["apps"]:
                    app_id = app.get("app_id") or app.get("app_name", "")
                    app_props[app_id] = app.get("fields", {})
            else:
                app_props = data
        else:
            app_props = extract_app_fields_from_markdown(content)

        # アプリ名が未指定の場合はフィールド設計書から取得
        if not app_names:
            app_names = list(app_props.keys())

        print(f"\nフィールド設計書から{len(app_props)}個のアプリを検出")

        # バリデーション
        errors = validate_fields(app_props)
        if errors:
            print(f"\n警告: {len(errors)}件のバリデーションエラー", file=sys.stderr)
            for err in errors:
                print(f"  - {err['app_id']}.{err['field_code']}: {err['error']}", file=sys.stderr)

    if not app_names:
        print("\nエラー: アプリ名が指定されていません", file=sys.stderr)
        sys.exit(1)

    # スペース設定
    space_name = args.space_name
    thread_name = args.thread_name

    if not space_name:
        space_name, thread_name = prompt_space_settings()

    if not thread_name:
        thread_name = space_name

    # 確認
    print("\n" + "=" * 50)
    print("実行内容の確認")
    print("=" * 50)
    print(f"サブドメイン: {subdomain}")
    print(f"スペース名: {space_name}")
    print(f"スレッド名: {thread_name}")
    print(f"作成アプリ数: {len(app_names)}")
    for name in app_names:
        field_count = len(app_props.get(name, {}))
        print(f"  - {name} ({field_count}フィールド)")

    if args.dry_run:
        print("\n[DRY RUN モード]")

    confirm = input("\n続行しますか？ (y/n): ").strip().lower()
    if confirm != "y":
        print("キャンセルしました")
        sys.exit(0)

    # 実行
    result = {"phase1": None, "phase2": None}

    try:
        # Phase 1
        phase1_result = run_phase1(client, space_name, thread_name, app_names, dry_run=args.dry_run)
        result["phase1"] = phase1_result

        # Phase 2
        if app_props:
            phase2_result = run_phase2(client, app_props, phase1_result["apps"], dry_run=args.dry_run)
            result["phase2"] = phase2_result

        # 完了
        print("\n" + "=" * 50)
        print("完了！")
        print("=" * 50)

        if not args.dry_run and phase1_result.get("space_id"):
            space_url = f"https://{subdomain}.cybozu.com/k/#/space/{phase1_result['space_id']}"
            print(f"スペースURL: {space_url}")

        # 結果出力
        if args.output:
            with open(args.output, "w", encoding="utf-8") as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
            print(f"\n結果を保存: {args.output}")

    except APIError as e:
        print(f"\nエラー: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
