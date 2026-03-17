#!/usr/bin/env python3
"""
Floorp Enhanced Effects テスト（ローカルHTMLページ使用）
"""

import requests
import json
import sys
import time
import os
from pathlib import Path
from typing import Optional

BASE_URL = "http://127.0.0.1:58261"
REQUEST_TIMEOUT = (5, 30)

# ANSI color codes
GREEN = '\033[0;32m'
BLUE = '\033[0;34m'
YELLOW = '\033[1;33m'
PURPLE = '\033[0;35m'
ORANGE = '\033[0;33m'
RED = '\033[0;31m'
NC = '\033[0m'  # No Color


class FloorpTabManager:
    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url
        self.instance_id: Optional[str] = None
        self.timeout = REQUEST_TIMEOUT

    def _get(self, path: str, **kwargs):
        kwargs.setdefault("timeout", self.timeout)
        return requests.get(f"{self.base_url}{path}", **kwargs)

    def _post(self, path: str, **kwargs):
        kwargs.setdefault("timeout", self.timeout)
        return requests.post(f"{self.base_url}{path}", **kwargs)

    def _delete(self, path: str, **kwargs):
        kwargs.setdefault("timeout", self.timeout)
        return requests.delete(f"{self.base_url}{path}", **kwargs)
    
    def create_instance(self, url: str, in_background: bool = False):
        """新しいタブインスタンスを作成"""
        resp = self._post(
            "/tabs/instances",
            json={"url": url, "inBackground": in_background},
        )
        resp.raise_for_status()
        data = resp.json()
        self.instance_id = data.get("instanceId")
        print(json.dumps(data, indent=2, ensure_ascii=False))
        print(f"{GREEN}✓ Instance ID: {self.instance_id}{NC}")
        return self.instance_id
    
    def click_element(self, selector: str = None, fingerprint: str = None):
        """要素をクリック（エフェクト付き）- selector または fingerprint を指定"""
        if not self.instance_id:
            raise ValueError("No instance created")
        if not selector and not fingerprint:
            raise ValueError("Either selector or fingerprint must be provided")

        json_data = {}
        if selector:
            json_data["selector"] = selector
        if fingerprint:
            json_data["fingerprint"] = fingerprint

        resp = self._post(
            f"/tabs/instances/{self.instance_id}/click",
            json=json_data
        )
        resp.raise_for_status()
        result = resp.json()
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return result

    def resolve_fingerprint(self, fingerprint: str):
        """フィンガープリントからCSSセレクタを解決"""
        if not self.instance_id:
            raise ValueError("No instance created")
        resp = self._get(
            f"/tabs/instances/{self.instance_id}/resolveFingerprint",
            params={"fingerprint": fingerprint}
        )
        resp.raise_for_status()
        result = resp.json()
        print(f"{BLUE}🔍 Fingerprint {fingerprint} → {result.get('selector', 'not found')}{NC}")
        return result
    
    def fill_form(self, form_data: dict):
        """フォームを一括入力（エフェクト付き）"""
        if not self.instance_id:
            raise ValueError("No instance created")
        resp = self._post(
            f"/tabs/instances/{self.instance_id}/fillForm",
            json={"formData": form_data}
        )
        resp.raise_for_status()
        result = resp.json()
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return result
    
    def submit(self, selector: str):
        """フォームを送信（エフェクト付き）"""
        if not self.instance_id:
            raise ValueError("No instance created")
        resp = self._post(
            f"/tabs/instances/{self.instance_id}/submit",
            json={"selector": selector}
        )
        resp.raise_for_status()
        result = resp.json()
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return result
    
    def destroy_instance(self):
        """インスタンスを削除"""
        if not self.instance_id:
            return
        resp = self._delete(
            f"/tabs/instances/{self.instance_id}"
        )
        resp.raise_for_status()
        result = resp.json()
        print(json.dumps(result, indent=2, ensure_ascii=False))
        self.instance_id = None
        return result

    def get_html(self):
        if not self.instance_id:
            raise ValueError("No instance created")
        resp = self._get(
            f"/tabs/instances/{self.instance_id}/html"
        )
        resp.raise_for_status()
        result = resp.json()
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return result

    def get_elements(self, selector: str):
        if not self.instance_id:
            raise ValueError("No instance created")
        resp = self._get(
            f"/tabs/instances/{self.instance_id}/elements",
            params={"selector": selector},
        )
        resp.raise_for_status()
        result = resp.json()
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return result

    def get_value(self, selector: str = None, fingerprint: str = None):
        """Get input value - supports selector OR fingerprint"""
        if not self.instance_id:
            raise ValueError("No instance created")
        params = {}
        if selector:
            params["selector"] = selector
        if fingerprint:
            params["fingerprint"] = fingerprint
        resp = self._get(
            f"/tabs/instances/{self.instance_id}/value",
            params=params,
        )
        resp.raise_for_status()
        result = resp.json()
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return result

    def wait_for_element(self, selector: str = None, fingerprint: str = None, timeout: int = 3000, state: str = None):
        """Wait for element - supports selector OR fingerprint"""
        if not self.instance_id:
            raise ValueError("No instance created")
        json_data = {"timeout": timeout}
        if selector:
            json_data["selector"] = selector
        if fingerprint:
            json_data["fingerprint"] = fingerprint
        if state:
            json_data["state"] = state
        resp = self._post(
            f"/tabs/instances/{self.instance_id}/waitForElement",
            json=json_data,
        )
        resp.raise_for_status()
        result = resp.json()
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return result

    def hover_element(self, selector: str = None, fingerprint: str = None):
        """Hover over element - supports selector OR fingerprint"""
        if not self.instance_id:
            raise ValueError("No instance created")
        json_data = {}
        if selector:
            json_data["selector"] = selector
        if fingerprint:
            json_data["fingerprint"] = fingerprint
        resp = self._post(
            f"/tabs/instances/{self.instance_id}/hover",
            json=json_data
        )
        resp.raise_for_status()
        result = resp.json()
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return result

    def scroll_to(self, selector: str = None, fingerprint: str = None):
        """Scroll to element - supports selector OR fingerprint"""
        if not self.instance_id:
            raise ValueError("No instance created")
        json_data = {}
        if selector:
            json_data["selector"] = selector
        if fingerprint:
            json_data["fingerprint"] = fingerprint
        resp = self._post(
            f"/tabs/instances/{self.instance_id}/scrollTo",
            json=json_data
        )
        resp.raise_for_status()
        result = resp.json()
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return result

    def get_element(self, selector: str = None, fingerprint: str = None):
        """Get element HTML - supports selector OR fingerprint"""
        if not self.instance_id:
            raise ValueError("No instance created")
        params = {}
        if selector:
            params["selector"] = selector
        if fingerprint:
            params["fingerprint"] = fingerprint
        resp = self._get(
            f"/tabs/instances/{self.instance_id}/element",
            params=params,
        )
        resp.raise_for_status()
        result = resp.json()
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return result

    def get_text(self, include_selector_map: bool = False):
        """Get page content as Markdown with element fingerprints"""
        if not self.instance_id:
            raise ValueError("No instance created")
        params = {"includeSelectorMap": "true"} if include_selector_map else {}
        resp = self._get(
            f"/tabs/instances/{self.instance_id}/text",
            params=params,
        )
        resp.raise_for_status()
        result = resp.json()
        text = result.get("text", "")
        label = "with Selector Map" if include_selector_map else "with Fingerprints"
        print(f"{PURPLE}🔍 Markdown {label} ({len(text)} chars):{NC}")
        print("-" * 40)
        print(text[:800] + ("..." if len(text) > 800 else ""))
        print("-" * 40)

        # Count fingerprints
        import re
        fingerprints = re.findall(r'<!--fp:([a-z0-9]{8}(?:[a-z0-9]{8})?)-->', text)
        print(f"{GREEN}✓ Found {len(fingerprints)} element fingerprints{NC}")
        return result

    def get_markdown_size_comparison(self):
        """Compare sizes of HTML vs Markdown output"""
        if not self.instance_id:
            raise ValueError("No instance created")

        # Get HTML
        resp_html = self._get(
            f"/tabs/instances/{self.instance_id}/html"
        )
        resp_html.raise_for_status()
        html_size = len(resp_html.json().get("html", ""))

        # Get Text (Markdown)
        resp_text = self._get(
            f"/tabs/instances/{self.instance_id}/text"
        )
        resp_text.raise_for_status()
        text_size = len(resp_text.json().get("text", ""))

        ratio = (text_size / html_size * 100) if html_size > 0 else 0
        print(f"{BLUE}📊 Size Comparison:{NC}")
        print(f"  HTML:    {html_size:,} chars")
        print(f"  Markdown: {text_size:,} chars")
        print(f"  {GREEN}Reduction: {100 - ratio:.1f}%{NC}")
        return {"html_size": html_size, "text_size": text_size, "ratio": ratio}

    def clear_effects(self):
        """Clear all highlight effects and overlays"""
        if not self.instance_id:
            raise ValueError("No instance created")
        resp = self._post(
            f"/tabs/instances/{self.instance_id}/clearEffects"
        )
        resp.raise_for_status()
        result = resp.json()
        print(f"{BLUE}🧹 Effects cleared{NC}")
        return result

    def get_text_silent(self, include_selector_map: bool = False):
        """Get text without printing (for internal use)"""
        if not self.instance_id:
            raise ValueError("No instance created")
        params = {"includeSelectorMap": "true"} if include_selector_map else {}
        resp = self._get(
            f"/tabs/instances/{self.instance_id}/text",
            params=params,
        )
        resp.raise_for_status()
        return resp.json()


def main() -> int:
    exit_code = 0
    failure_count = 0

    def record_failure(message: str) -> None:
        nonlocal exit_code, failure_count
        exit_code = 1
        failure_count += 1
        print(f"{RED}    ✗ {message}{NC}")

    print("=" * 42)
    print("🎨 Floorp Enhanced Effects デモ")
    print("=" * 42)
    print()
    
    # テストページのパスを取得
    script_dir = Path(__file__).parent
    test_page_path = script_dir / "test-page.html"
    test_page_url = test_page_path.resolve().as_uri()

    print(f"📄 Test Page: {test_page_url}")
    print()
    
    manager = FloorpTabManager()
    
    try:
        # Step 1: タブインスタンスを作成
        print(f"{BLUE}📋 Step 1: Create Tab Instance with Test Page{NC}")
        manager.create_instance(test_page_url, in_background=False)
        print()
        time.sleep(2)
        
        # Step 2: フォーム入力テスト（自動的に紫色のエフェクト + 3秒インターバル）
        print(f"{BLUE}📋 Step 2: Fill Form with Enhanced Effects{NC}")
        manager.fill_form({
            "#name": "山田太郎",
            "#email": "yamada@floorp.app",
            "#message": "Floorp のエンハンスドエフェクトは素晴らしいです！"
        })
        print(f"{PURPLE}✓ フォーム入力完了（紫色のエフェクト + 各フィールドの進捗表示 + 3秒表示）{NC}")
        print(f"{YELLOW}👀 ブラウザを確認：右上に情報パネルと進捗、各フィールドに紫色のエフェクトが表示されます{NC}")
        print()
        
        # Step 3: 送信ボタンをクリック（自動的にオレンジ色のエフェクト + 3秒インターバル）
        print(f"{BLUE}📋 Step 3: Click Submit Button with Enhanced Effects{NC}")
        manager.click_element("#submitBtn")
        print(f"{ORANGE}✓ 送信ボタンをクリック（オレンジ色のエフェクト + 情報パネル + 3秒表示）{NC}")
        print(f"{YELLOW}👀 送信ボタンにオレンジ色のハイライトが表示されました{NC}")
        print()
        
        # Step 4: リセットボタンをクリック（自動的に3秒インターバル）
        print(f"{BLUE}📋 Step 4: Click Reset Button{NC}")
        manager.click_element("#resetBtn")
        print(f"{GREEN}✓ リセットボタンをクリック（オレンジ色のエフェクト + 3秒表示）{NC}")
        print()
        
        # Step 5: フォームを再入力してSubmit（赤色のエフェクト + 自動的に3秒インターバル）
        print(f"{BLUE}📋 Step 5: Fill and Submit Form{NC}")
        manager.fill_form({
            "#name": "佐藤花子",
            "#email": "sato@floorp.app",
            "#message": "テスト送信"
        })
        
        manager.submit("#testForm")
        print(f"{RED}✓ フォーム送信（赤色のエフェクト + 情報パネル + 3秒表示）{NC}")
        print(f"{YELLOW}👀 フォーム全体に赤色のハイライトが表示されました{NC}")
        print()

        # Step 6: 取得系 API（Inspect ハイライト）の確認
        print(f"{BLUE}📋 Step 6: Inspect APIs (highlight only){NC}")
        print(f"{BLUE}  └ getHTML{NC}")
        manager.get_html()
        time.sleep(2.2)

        print(f"{BLUE}  └ getText (Markdown with fingerprints){NC}")
        manager.get_text()
        time.sleep(2.2)

        print(f"{BLUE}  └ getText with Selector Map{NC}")
        manager.get_text(include_selector_map=True)
        time.sleep(2.2)

        print(f"{BLUE}  └ Size Comparison (HTML vs Markdown){NC}")
        manager.get_markdown_size_comparison()
        time.sleep(2.2)

        print(f"{BLUE}  └ getElement (Submit Button){NC}")
        manager.get_element("#submitBtn")
        time.sleep(2.2)

        print(f"{BLUE}  └ getElements (Input fields){NC}")
        manager.get_elements("form input")
        time.sleep(2.2)

        print(f"{BLUE}  └ getValue (Name field){NC}")
        manager.get_value("#name")
        time.sleep(2.2)
        print(f"{GREEN}✓ 取得系 API を呼び出し、Inspect ハイライトを確認{NC}")
        print()

        # Step 7: Fingerprint-based operations test
        print(f"{BLUE}📋 Step 7: Fingerprint-based element operations (comprehensive){NC}")
        print(f"{BLUE}  └ Clearing effects to get clean DOM...{NC}")
        manager.clear_effects()
        time.sleep(0.5)

        # Get fresh fingerprints after clearing effects
        print(f"{BLUE}  └ Getting fresh fingerprints...{NC}")
        text_result = manager.get_text_silent()
        text_content = text_result.get("text", "")

        # Extract fingerprints from the markdown
        import re
        fingerprints = re.findall(r'<!--fp:([a-z0-9]{8}(?:[a-z0-9]{8})?)-->', text_content)
        print(f"{GREEN}  ✓ Found {len(fingerprints)} fingerprints{NC}")

        if fingerprints:
            # Find fingerprints for different element types
            box_fingerprint = None
            heading_fingerprint = None

            for i, fp in enumerate(fingerprints):
                if i < 3:
                    continue
                try:
                    resp = manager._get(
                        f"/tabs/instances/{manager.instance_id}/resolveFingerprint",
                        params={"fingerprint": fp},
                    )
                    if resp.status_code == 200:
                        result = resp.json()
                        selector = result.get("selector", "")
                        if "box" in selector.lower() and not box_fingerprint:
                            box_fingerprint = fp
                            print(f"{GREEN}  ✓ Found box element: {fp} → {selector}{NC}")
                        elif ("h1" in selector or "h2" in selector) and not heading_fingerprint:
                            heading_fingerprint = fp
                except Exception:
                    pass

            # Test with box element if found
            if box_fingerprint:
                print(f"{BLUE}  └ Test: Click box element via fingerprint{NC}")
                try:
                    click_result = manager.click_element(fingerprint=box_fingerprint)
                    print(f"{GREEN}    ✓ Click via fingerprint successful{NC}")
                except Exception as e:
                    record_failure(f"Click via fingerprint failed: {e}")

                print(f"{BLUE}  └ Test: Hover element via fingerprint{NC}")
                try:
                    hover_result = manager.hover_element(fingerprint=box_fingerprint)
                    print(f"{GREEN}    ✓ Hover via fingerprint successful{NC}")
                except Exception as e:
                    record_failure(f"Hover via fingerprint failed: {e}")

                print(f"{BLUE}  └ Test: Get element via fingerprint{NC}")
                try:
                    elem_result = manager.get_element(fingerprint=box_fingerprint)
                    print(f"{GREEN}    ✓ Get element via fingerprint successful{NC}")
                except Exception as e:
                    record_failure(f"Get element via fingerprint failed: {e}")

            # Test getValue with fingerprint (name field)
            # First, find the name field fingerprint by looking at the page content
            print(f"{BLUE}  └ Test: GetValue via fingerprint (finding input field){NC}")
            for fp in fingerprints[10:20]:  # Check middle fingerprints
                try:
                    resp = manager._get(
                        f"/tabs/instances/{manager.instance_id}/resolveFingerprint",
                        params={"fingerprint": fp},
                    )
                    if resp.status_code == 200:
                        selector = resp.json().get("selector", "")
                        if "#name" in selector:
                            print(f"{GREEN}    Found name field: {fp} → {selector}{NC}")
                            try:
                                val_result = manager.get_value(fingerprint=fp)
                                print(f"{GREEN}    ✓ GetValue via fingerprint successful{NC}")
                            except Exception as e:
                                record_failure(f"GetValue via fingerprint failed: {e}")
                            break
                except Exception:
                    pass

        else:
            print(f"{YELLOW}  ⚠ No fingerprints found in text output{NC}")
        print()

        # Step 8: Wait contract and selector/fingerprint priority checks
        print(f"{BLUE}📋 Step 8: Wait contract and fallback checks{NC}")

        print(f"{BLUE}  └ waitForElement with selector (#title){NC}")
        try:
            wait_result = manager.wait_for_element(selector="#title", timeout=2500)
            if wait_result.get("ok") is True and wait_result.get("found") is True:
                print(f"{GREEN}    ✓ waitForElement selector contract ok=true,found=true{NC}")
            else:
                record_failure(f"Unexpected wait result: {wait_result}")
        except Exception as e:
            record_failure(f"waitForElement selector failed: {e}")

        if fingerprints:
            fp_any = fingerprints[0]
            print(f"{BLUE}  └ waitForElement with fingerprint ({fp_any}){NC}")
            try:
                wait_fp_result = manager.wait_for_element(fingerprint=fp_any, timeout=2500, state="visible")
                if (
                    wait_fp_result.get("ok") is True
                    and wait_fp_result.get("found") is True
                ):
                    print(f"{GREEN}    ✓ waitForElement fingerprint contract ok=true,found=true{NC}")
                else:
                    record_failure(f"Unexpected wait fingerprint result: {wait_fp_result}")
            except Exception as e:
                record_failure(f"waitForElement fingerprint failed: {e}")

            print(f"{BLUE}  └ selector priority over invalid fingerprint{NC}")
            try:
                resp = manager._post(
                    f"/tabs/instances/{manager.instance_id}/click",
                    json={"selector": "#submitBtn", "fingerprint": "bad!"},
                )
                if resp.status_code == 200:
                    print(f"{GREEN}    ✓ selector takes priority over invalid fingerprint{NC}")
                else:
                    record_failure(f"Expected 200, got {resp.status_code}: {resp.text}")
            except Exception as e:
                record_failure(f"selector priority test failed: {e}")

        print()

        # Step 9: Negative test cases for fingerprint validation
        print(f"{BLUE}📋 Step 9: Fingerprint validation tests{NC}")

        # Test 9a: Invalid fingerprint format
        print(f"{BLUE}  └ Test invalid fingerprint format{NC}")
        try:
            resp = manager._get(
                f"/tabs/instances/{manager.instance_id}/resolveFingerprint",
                params={"fingerprint": "invalid!"},
            )
            if resp.status_code == 400:
                print(f"{GREEN}    ✓ Invalid fingerprint correctly rejected with 400{NC}")
            else:
                record_failure(f"Invalid fingerprint expected 400, got {resp.status_code}")
        except Exception as e:
            record_failure(f"Invalid fingerprint test error: {e}")

        # Test 9b: Non-existent fingerprint -> 404
        print(f"{BLUE}  └ Test non-existent fingerprint{NC}")
        try:
            resp = manager._get(
                f"/tabs/instances/{manager.instance_id}/resolveFingerprint",
                params={"fingerprint": "zzzzzzzz"},
            )
            if resp.status_code == 404:
                print(f"{GREEN}    ✓ Non-existent fingerprint correctly returns 404{NC}")
            else:
                record_failure(f"Non-existent fingerprint expected 404, got {resp.status_code}")
        except Exception as e:
            record_failure(f"Non-existent fingerprint test error: {e}")

        # Test 9c: Click with invalid fingerprint
        print(f"{BLUE}  └ Test click with invalid fingerprint{NC}")
        try:
            resp = manager._post(
                f"/tabs/instances/{manager.instance_id}/click",
                json={"fingerprint": "badformat"},
            )
            if resp.status_code == 400:
                print(f"{GREEN}    ✓ Click with invalid fingerprint correctly rejected with 400{NC}")
            else:
                record_failure(f"Click invalid fingerprint expected 400, got {resp.status_code}")
        except Exception as e:
            record_failure(f"Click invalid fingerprint test error: {e}")

        # Test 9d: Missing selector/fingerprint in click payload
        print(f"{BLUE}  └ Test click with missing selector and fingerprint{NC}")
        try:
            resp = manager._post(
                f"/tabs/instances/{manager.instance_id}/click",
                json={},
            )
            if resp.status_code == 400:
                print(f"{GREEN}    ✓ Missing selector/fingerprint correctly rejected with 400{NC}")
            else:
                record_failure(f"Click missing selector/fingerprint expected 400, got {resp.status_code}")
        except Exception as e:
            record_failure(f"Click missing selector/fingerprint test error: {e}")

        # Test 9e: waitForElement missing selector/fingerprint
        print(f"{BLUE}  └ Test waitForElement with missing selector and fingerprint{NC}")
        try:
            resp = manager._post(
                f"/tabs/instances/{manager.instance_id}/waitForElement",
                json={"timeout": 100},
            )
            if resp.status_code == 400:
                print(f"{GREEN}    ✓ waitForElement missing selector/fingerprint rejected with 400{NC}")
            else:
                record_failure(f"waitForElement missing selector/fingerprint expected 400, got {resp.status_code}")
        except Exception as e:
            record_failure(f"waitForElement missing selector/fingerprint test error: {e}")

        print(f"{GREEN}✓ Fingerprint validation tests completed{NC}")
        if failure_count > 0:
            print(f"{RED}❌ Detected {failure_count} assertion failure(s) during test steps{NC}")
        print()
        
        # クリーンアップ
        print(f"{BLUE}🧹 Cleanup: Destroying instance{NC}")
        manager.destroy_instance()
        print()
        
        print("=" * 42)
        print(f"{GREEN}✅ デモ完了！{NC}")
        print("=" * 42)
        print()
        print("📊 確認できた機能:")
        print(f"  {GREEN}✓{NC} 右上の操作情報パネル（アクション、要素情報、進捗表示）")
        print(f"  {GREEN}✓{NC} アクション別の色分け（自動適用）:")
        print(f"      {PURPLE}■{NC} Fill/Input = 紫色")
        print(f"      {ORANGE}■{NC} Click = オレンジ色")
        print(f"      {RED}■{NC} Submit = 赤色")
        print(f"  {GREEN}✓{NC} 各操作での詳細な情報表示（要素名、進捗など）")
        print(f"  {GREEN}✓{NC} 既存APIの自動エフェクト化（新規エンドポイント不要）")
        print(f"  {GREEN}✓{NC} フィンガープリント機能:")
        print(f"      - MD出力へのフィンガープリント埋め込み")
        print(f"      - フィンガープリント → CSSセレクタ解決")
        print(f"      - フィンガープリント経由での要素クリック")
        print(f"      - 不正なフィンガープリントの検証（400エラー）")
        print()
        
    except requests.exceptions.RequestException as e:
        exit_code = 1
        print(f"{RED}❌ HTTP Error: {e}{NC}")
        if hasattr(e, 'response') and e.response is not None:
            try:
                print(json.dumps(e.response.json(), indent=2, ensure_ascii=False))
            except Exception:
                print(e.response.text)
        import traceback
        traceback.print_exc()
    except Exception as e:
        exit_code = 1
        print(f"{RED}❌ Error: {e}{NC}")
        import traceback
        traceback.print_exc()
    finally:
        # クリーンアップ（エラー時も実行）
        if manager.instance_id:
            print(f"{BLUE}🧹 Cleanup: Destroying instance...{NC}")
            try:
                manager.destroy_instance()
            except Exception:
                pass

    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())

