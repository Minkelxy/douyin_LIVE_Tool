#!/usr/bin/env python3
import asyncio
import json
import sys
import time
from pathlib import Path
from playwright.async_api import async_playwright, expect

class DouyinLogin:
    def __init__(self):
        self.cookies = None
        self.user_data_dir = Path(__file__).parent / "data" / "browser_data"
        self.user_data_dir.mkdir(exist_ok=True, parents=True)

    async def login_with_qrcode(self):
        """通过二维码扫码登录抖音"""
        print("正在启动浏览器...")

        async with async_playwright() as p:
            context = await p.chromium.launch_persistent_context(
                user_data_dir=str(self.user_data_dir),
                headless=False,
                args=['--disable-blink-features=AutomationControlled']
            )

            page = context.pages[0] if context.pages else await context.new_page()

            print("正在打开抖音直播网页...")
            await page.goto("https://live.douyin.com/")

            await asyncio.sleep(2)

            try:
                login_btn = page.locator('text=登录').first
                if await login_btn.is_visible(timeout=5000):
                    print("点击登录按钮...")
                    await login_btn.click()
                    await asyncio.sleep(1)
            except:
                print("未找到登录按钮，尝试其他方式...")

            try:
                qrcode_button = page.locator('[class*="qrcode"]').first
                if await qrcode_button.is_visible(timeout=3000):
                    print("找到二维码登录入口，点击...")
                    await qrcode_button.click()
                    await asyncio.sleep(1)
            except:
                pass

            try:
                print("\n" + "="*60)
                print("等待扫码登录...")
                print("请使用抖音App扫描屏幕上的二维码")
                print("="*60 + "\n")

                qrcode_img = page.locator('img[src*="qrcode"]').first
                if await qrcode_img.is_visible(timeout=10000):
                    print("✅ 检测到二维码，请扫码！")

                    page.locator('[class*="modal"], [class*="dialog"], [class*="login"]')
                    await page.wait_for_function(
                        "() => document.cookie.includes('sessionid') || document.cookie.includes('sid_tt')",
                        timeout=120000
                    )

                    print("\n✅ 登录成功！正在获取Cookie...")

                    self.cookies = await context.cookies()

                    cookies_dict = {}
                    for cookie in self.cookies:
                        cookies_dict[cookie['name']] = cookie['value']

                    cookie_str = '; '.join([f"{k}={v}" for k, v in cookies_dict.items()])

                    print(f"\n获取到 {len(self.cookies)} 个Cookie")

                    await context.close()

                    return cookie_str

            except asyncio.TimeoutError:
                print("\n❌ 扫码超时，请重试")
                await context.close()
                return None
            except Exception as e:
                print(f"\n❌ 登录过程出错: {e}")
                await context.close()
                return None

    def save_cookies(self, cookie_str):
        """保存Cookie到文件"""
        cookie_file = Path(__file__).parent / "data" / "cookie.txt"
        cookie_file.parent.mkdir(exist_ok=True, parents=True)
        cookie_file.write_text(cookie_str)
        print(f"✅ Cookie已保存到: {cookie_file}")

    async def login_and_save(self):
        """登录并保存Cookie"""
        cookie_str = await self.login_with_qrcode()

        if cookie_str:
            self.save_cookies(cookie_str)
            return cookie_str
        else:
            return None

def main():
    login = DouyinLogin()

    try:
        cookie = asyncio.run(login.login_and_save())

        if cookie:
            print("\n" + "="*60)
            print("登录成功！现在可以运行主程序监控弹幕了")
            print("="*60)
        else:
            print("\n登录失败，请重试")
            sys.exit(1)

    except KeyboardInterrupt:
        print("\n\n操作已取消")
        sys.exit(0)

if __name__ == '__main__':
    main()
