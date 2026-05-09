#!/usr/bin/env python3
"""
抖音弹幕助手 - 自动登录模块

此模块提供两种登录方式:
1. 自动扫码登录 (需要图形界面)
2. 手动获取Cookie (通用方法)

由于抖音安全限制，自动获取Cookie需要用户配合操作
"""

import json
import sys
import time
from pathlib import Path
from datetime import datetime

class DouyinAutoLogin:
    def __init__(self):
        self.cookie_file = Path(__file__).parent / "data" / "cookie.txt"
        self.cookie_file.parent.mkdir(exist_ok=True, parents=True)

    def try_playwright_login(self):
        """尝试使用Playwright扫码登录"""
        try:
            from playwright.sync_api import sync_playwright

            print("\n" + "="*60)
            print("方式1: Playwright 自动扫码登录")
            print("="*60)

            with sync_playwright() as p:
                print("\n正在启动浏览器...")
                browser = p.chromium.launch(headless=False)

                context = browser.new_context(
                    user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                )

                page = context.new_page()

                print("正在打开抖音直播页面...")
                page.goto("https://live.douyin.com/")
                time.sleep(2)

                try:
                    login_link = page.locator('text=登录').first
                    if login_link.is_visible():
                        print("点击登录...")
                        login_link.click()
                        time.sleep(1)

                        qrcode_tab = page.locator('text=扫码登录').first
                        if qrcode_tab.is_visible():
                            qrcode_tab.click()
                            time.sleep(1)
                except:
                    pass

                print("\n" + "="*60)
                print("等待扫码...")
                print("请使用抖音App扫描屏幕上的二维码")
                print("二维码会在浏览器窗口中显示")
                print("扫码后等待几秒...")
                print("="*60)

                page.wait_for_url("**/live.douyin.com/**", timeout=60000)

                print("\n✅ 登录成功！正在提取Cookie...")

                cookies = context.cookies()

                cookie_str = '; '.join([f"{c['name']}={c['value']}" for c in cookies])

                self.save_cookie(cookie_str)

                browser.close()

                return cookie_str

        except ImportError:
            print("⚠️  Playwright未安装，跳过自动登录")
            return None
        except Exception as e:
            print(f"❌ 自动登录失败: {e}")
            return None

    def try_edge_cookie(self):
        """尝试从Edge浏览器提取Cookie (Windows)"""
        if sys.platform != 'win32':
            return None

        try:
            import sqlite3
            from pathlib import Path

            edge_cookie_path = Path.home() / "AppData" / "Local" / "Microsoft" / "Edge" / "User Data" / "Default" / "Network" / "Cookies"

            if not edge_cookie_path.exists():
                return None

            conn = sqlite3.connect(str(edge_cookie_path))
            cursor = conn.cursor()

            cursor.execute("""
                SELECT name, value, host_key
                FROM cookies
                WHERE host_key LIKE '%douyin%'
            """)

            cookies = {}
            for name, value, host in cursor.fetchall():
                cookies[name] = value

            conn.close()

            if cookies:
                print(f"\n✅ 从Edge浏览器找到 {len(cookies)} 个Cookie")

                important_cookies = ['sessionid', 'sessionid_ss', 'sid_tt', 'uid_tt', 'sid_guard']
                found = [k for k in important_cookies if k in cookies]

                if found:
                    cookie_str = '; '.join([f"{k}={cookies[k]}" for k in found])
                    self.save_cookie(cookie_str)
                    return cookie_str

        except Exception as e:
            print(f"⚠️  读取Edge Cookie失败: {e}")

        return None

    def save_cookie(self, cookie_str):
        """保存Cookie"""
        self.cookie_file.write_text(cookie_str, encoding='utf-8')
        print(f"\n✅ Cookie已保存到: {self.cookie_file}")

    def show_manual_guide(self):
        """显示手动获取Cookie指南"""
        guide = """

╔═══════════════════════════════════════════════════════════════════╗
║                    手动获取Cookie教程                          ║
╚═══════════════════════════════════════════════════════════════════╝

【步骤说明】

1. 打开 Chrome 或 Edge 浏览器
2. 访问 https://live.douyin.com/
3. 确保已登录您的抖音账号
4. 按 F12 打开开发者工具（或右键 → 检查）

5. 点击顶部的 "Application" (应用) 标签

6. 在左侧菜单中，展开 "Cookies"
7. 点击 "https://live.douyin.com"

8. 找到以下Cookie，复制它们的值:
   ★ sessionid    ★ sessionid_ss    ★ sid_tt
   ★ uid_tt      ★ sid_guard       ★ ttwid

9. 将所有Cookie值组合成字符串:
   格式: sessionid=xxx; sessionid_ss=xxx; sid_tt=xxx; ...

10. 运行主程序，在设置Cookie时粘贴即可

═══════════════════════════════════════════════════════════════════════

【快速复制技巧】

打开Console标签，输入以下代码并回车:

    copy(document.cookie)

然后在程序中粘贴即可

═══════════════════════════════════════════════════════════════════════

"""
        print(guide)

    def run(self):
        """运行自动登录流程"""
        print("\n" + "="*60)
        print("抖音弹幕助手 - Cookie自动获取")
        print("="*60)

        print("\n正在检查系统环境...")

        result = self.try_edge_cookie()

        if not result:
            print("\n正在尝试浏览器扫码登录...")

            try:
                result = self.try_playwright_login()
            except:
                pass

        if not result:
            print("\n" + "="*60)
            print("自动获取Cookie失败")
            print("="*60)
            self.show_manual_guide()
            return None

        return result

def main():
    login = DouyinAutoLogin()

    try:
        cookie = login.run()

        if cookie:
            print("\n" + "="*60)
            print("✅ Cookie获取成功！")
            print("\n现在可以运行主程序:")
            print("  python main.py")
            print("="*60)
        else:
            print("\n请按照上述指南手动获取Cookie")

    except KeyboardInterrupt:
        print("\n\n操作已取消")
        sys.exit(0)

if __name__ == '__main__':
    main()
