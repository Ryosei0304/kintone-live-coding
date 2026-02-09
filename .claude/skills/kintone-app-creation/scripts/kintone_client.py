#!/usr/bin/env python3
"""
kintone API Client

Usage:
    # 認証テスト
    python kintone_client.py verify --subdomain mycompany --user user@example.com --password xxx

    # スペース作成
    python kintone_client.py create-space --subdomain mycompany --user user@example.com --password xxx --name "プロジェクト名"

    # スレッド作成
    python kintone_client.py create-thread --subdomain mycompany --user user@example.com --password xxx --space-id 123 --name "スレッド名"

    # アプリ作成
    python kintone_client.py create-app --subdomain mycompany --user user@example.com --password xxx --space-id 123 --thread-id 456 --name "アプリ名"

    # フィールド追加
    python kintone_client.py add-fields --subdomain mycompany --user user@example.com --password xxx --app-id 789 --properties-file fields.json

    # デプロイ
    python kintone_client.py deploy --subdomain mycompany --user user@example.com --password xxx --app-ids 789,790,791
"""

import argparse
import base64
import json
import sys
import time
from typing import Any, Dict, List, Optional

import requests


class KintoneClient:
    """kintone REST API Client"""

    def __init__(self, subdomain: str, user_id: str, password: str):
        self.subdomain = subdomain
        self.base_url = f"https://{subdomain}.cybozu.com"

        # Base64エンコードで認証文字列を作成
        auth_string = f"{user_id}:{password}"
        encoded_auth = base64.b64encode(auth_string.encode()).decode()

        self.headers = {
            "X-Cybozu-Authorization": encoded_auth,
            "Content-Type": "application/json",
        }

        # リトライ設定
        self.max_retries = 3
        self.base_delay = 1.0

    def _request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = None,
        retry: bool = True,
    ) -> Dict[str, Any]:
        """API呼び出し（リトライ付き）"""
        url = f"{self.base_url}{endpoint}"

        for attempt in range(self.max_retries if retry else 1):
            try:
                if method == "GET":
                    response = requests.get(url, headers=self.headers, json=data, timeout=60)
                elif method == "POST":
                    response = requests.post(url, headers=self.headers, json=data, timeout=60)
                elif method == "PUT":
                    response = requests.put(url, headers=self.headers, json=data, timeout=60)
                elif method == "DELETE":
                    response = requests.delete(url, headers=self.headers, json=data, timeout=60)
                else:
                    raise ValueError(f"Unsupported method: {method}")

                if response.status_code == 200:
                    return response.json()

                # エラーハンドリング
                error = response.json() if response.text else {}
                error_msg = error.get("message", f"HTTP {response.status_code}")

                if response.status_code == 401:
                    raise AuthError(f"認証エラー: {error_msg}")
                elif response.status_code == 403:
                    raise PermissionError(f"権限エラー: {error_msg}")
                elif response.status_code == 404:
                    raise NotFoundError(f"リソースが見つかりません: {error_msg}")
                elif response.status_code == 429:
                    # レートリミット
                    if attempt < self.max_retries - 1:
                        delay = self.base_delay * (2**attempt)
                        print(f"  レートリミット。{delay:.1f}秒後にリトライ...", file=sys.stderr)
                        time.sleep(delay)
                        continue
                    raise RateLimitError(f"レートリミット超過: {error_msg}")
                elif response.status_code >= 500:
                    # サーバーエラー
                    if attempt < self.max_retries - 1:
                        delay = self.base_delay * (2**attempt)
                        print(f"  サーバーエラー。{delay:.1f}秒後にリトライ...", file=sys.stderr)
                        time.sleep(delay)
                        continue
                    raise ServerError(f"サーバーエラー: {error_msg}")
                else:
                    raise APIError(f"APIエラー ({response.status_code}): {error_msg}")

            except requests.exceptions.Timeout:
                if attempt < self.max_retries - 1:
                    delay = self.base_delay * (2**attempt)
                    print(f"  タイムアウト。{delay:.1f}秒後にリトライ...", file=sys.stderr)
                    time.sleep(delay)
                    continue
                raise TimeoutError("リクエストがタイムアウトしました")

        raise APIError("リトライ回数を超えました")

    def verify_credentials(self) -> bool:
        """認証情報を検証"""
        try:
            # ダミーのfileKeyでユーザーCSVインポートAPIを呼び出し
            # 400=認証OK、401=認証NG、403=権限不足
            url = f"{self.base_url}/v1/csv/user.json"
            response = requests.post(
                url,
                headers=self.headers,
                json={"fileKey": "00000000-0000-0000-0000-000000000000"},
                timeout=10,
            )
            if response.status_code == 400:
                return True  # 認証成功（パラメータエラーは期待通り）
            elif response.status_code == 401:
                raise AuthError("認証に失敗しました。ユーザーIDまたはパスワードが正しくありません。")
            elif response.status_code == 403:
                raise PermissionError("権限が不足しています。cybozu.com共通管理者権限が必要です。")
            return True
        except requests.exceptions.ConnectionError:
            raise ConnectionError(f"サーバーに接続できません。サブドメイン '{self.subdomain}' を確認してください。")

    def create_space(self, name: str) -> Dict[str, Any]:
        """スペースを作成"""
        return self._request("POST", "/k/v1/space.json", {"name": name})

    def update_space(
        self,
        space_id: int,
        use_multi_thread: Optional[bool] = None,
        name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """スペース設定を更新"""
        data: Dict[str, Any] = {"id": space_id}
        if use_multi_thread is not None:
            data["useMultiThread"] = use_multi_thread
        if name is not None:
            data["name"] = name
        return self._request("PUT", "/k/v1/space.json", data)

    def create_thread(self, space_id: int, name: str) -> Dict[str, Any]:
        """スレッドを作成"""
        return self._request("POST", "/k/v1/space/thread.json", {"space": space_id, "name": name})

    def create_app(self, name: str, space_id: int, thread_id: int) -> Dict[str, Any]:
        """アプリを作成（プレビュー環境）"""
        return self._request(
            "POST",
            "/k/v1/preview/app.json",
            {"name": name, "space": space_id, "thread": thread_id},
        )

    def add_fields(self, app_id: int, properties: Dict[str, Any]) -> Dict[str, Any]:
        """フィールドを追加"""
        return self._request(
            "POST",
            "/k/v1/preview/app/form/fields.json",
            {"app": app_id, "properties": properties},
        )

    def update_fields(self, app_id: int, properties: Dict[str, Any]) -> Dict[str, Any]:
        """フィールドを更新"""
        return self._request(
            "PUT",
            "/k/v1/preview/app/form/fields.json",
            {"app": app_id, "properties": properties},
        )

    def deploy(self, app_ids: List[int]) -> Dict[str, Any]:
        """本番環境にデプロイ"""
        apps = [{"app": app_id} for app_id in app_ids]
        return self._request("POST", "/k/v1/preview/app/deploy.json", {"apps": apps})

    def check_deploy_status(self, app_ids: List[int], max_attempts: int = 10) -> Dict[str, Any]:
        """デプロイ状況を確認（ポーリング）"""
        for attempt in range(max_attempts):
            result = self._request("GET", "/k/v1/preview/app/deploy.json", {"apps": app_ids})
            apps = result.get("apps", [])

            # 全アプリが完了したかチェック
            all_done = all(app.get("status") in ["SUCCESS", "FAIL", "CANCEL"] for app in apps)
            if all_done:
                return result

            # まだ処理中の場合は待機
            processing = [app.get("app") for app in apps if app.get("status") == "PROCESSING"]
            print(f"  デプロイ中: {processing} ({attempt + 1}/{max_attempts})", file=sys.stderr)
            time.sleep(3)

        return result

    def get_form_layout(self, app_id: int) -> Dict[str, Any]:
        """フォームレイアウトを取得"""
        return self._request("GET", "/k/v1/preview/app/form/layout.json", {"app": app_id})

    def update_form_layout(self, app_id: int, layout: List[Dict]) -> Dict[str, Any]:
        """フォームレイアウトを更新"""
        return self._request(
            "PUT",
            "/k/v1/preview/app/form/layout.json",
            {"app": app_id, "layout": layout},
        )

    def upload_file(self, file_path: str, file_name: str) -> Dict[str, Any]:
        """ファイルをアップロード"""
        url = f"{self.base_url}/k/v1/file.json"
        headers = {k: v for k, v in self.headers.items() if k != "Content-Type"}

        with open(file_path, "rb") as f:
            response = requests.post(
                url,
                headers=headers,
                files={"file": (file_name, f, "application/octet-stream")},
                timeout=60,
            )

        if response.status_code == 200:
            return response.json()
        raise APIError(f"ファイルアップロード失敗: {response.status_code}")

    def update_customize(
        self,
        app_id: int,
        desktop_js: List[Dict] = None,
        desktop_css: List[Dict] = None,
        mobile_js: List[Dict] = None,
        mobile_css: List[Dict] = None,
        scope: str = "ALL",
    ) -> Dict[str, Any]:
        """カスタマイズ設定を更新"""
        return self._request(
            "PUT",
            "/k/v1/preview/app/customize.json",
            {
                "app": app_id,
                "scope": scope,
                "desktop": {"js": desktop_js or [], "css": desktop_css or []},
                "mobile": {"js": mobile_js or [], "css": mobile_css or []},
            },
        )


# カスタム例外
class APIError(Exception):
    pass


class AuthError(APIError):
    pass


class PermissionError(APIError):
    pass


class NotFoundError(APIError):
    pass


class RateLimitError(APIError):
    pass


class ServerError(APIError):
    pass


def main():
    parser = argparse.ArgumentParser(description="kintone API Client")
    parser.add_argument("--subdomain", required=True, help="kintoneサブドメイン")
    parser.add_argument("--user", required=True, help="ユーザーID")
    parser.add_argument("--password", required=True, help="パスワード")

    subparsers = parser.add_subparsers(dest="command", help="コマンド")

    # verify
    subparsers.add_parser("verify", help="認証情報を検証")

    # create-space
    p = subparsers.add_parser("create-space", help="スペースを作成")
    p.add_argument("--name", required=True, help="スペース名")

    # enable-multithread
    p = subparsers.add_parser("enable-multithread", help="マルチスレッドを有効化")
    p.add_argument("--space-id", type=int, required=True, help="スペースID")

    # create-thread
    p = subparsers.add_parser("create-thread", help="スレッドを作成")
    p.add_argument("--space-id", type=int, required=True, help="スペースID")
    p.add_argument("--name", required=True, help="スレッド名")

    # create-app
    p = subparsers.add_parser("create-app", help="アプリを作成")
    p.add_argument("--space-id", type=int, required=True, help="スペースID")
    p.add_argument("--thread-id", type=int, required=True, help="スレッドID")
    p.add_argument("--name", required=True, help="アプリ名")

    # add-fields
    p = subparsers.add_parser("add-fields", help="フィールドを追加")
    p.add_argument("--app-id", type=int, required=True, help="アプリID")
    p.add_argument("--properties-file", required=True, help="フィールド定義JSONファイル")

    # deploy
    p = subparsers.add_parser("deploy", help="本番環境にデプロイ")
    p.add_argument("--app-ids", required=True, help="アプリID（カンマ区切り）")
    p.add_argument("--wait", action="store_true", help="デプロイ完了を待機")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    # クライアント初期化
    client = KintoneClient(args.subdomain, args.user, args.password)

    try:
        if args.command == "verify":
            client.verify_credentials()
            print(json.dumps({"success": True, "message": "認証成功"}))

        elif args.command == "create-space":
            result = client.create_space(args.name)
            print(json.dumps(result))

        elif args.command == "enable-multithread":
            result = client.update_space(args.space_id, use_multi_thread=True)
            print(json.dumps({"success": True, "space_id": args.space_id}))

        elif args.command == "create-thread":
            result = client.create_thread(args.space_id, args.name)
            print(json.dumps(result))

        elif args.command == "create-app":
            result = client.create_app(args.name, args.space_id, args.thread_id)
            print(json.dumps(result))

        elif args.command == "add-fields":
            with open(args.properties_file, "r", encoding="utf-8") as f:
                properties = json.load(f)
            result = client.add_fields(args.app_id, properties)
            print(json.dumps(result))

        elif args.command == "deploy":
            app_ids = [int(x.strip()) for x in args.app_ids.split(",")]
            result = client.deploy(app_ids)
            if args.wait:
                result = client.check_deploy_status(app_ids)
            print(json.dumps(result))

    except APIError as e:
        print(json.dumps({"success": False, "error": str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
