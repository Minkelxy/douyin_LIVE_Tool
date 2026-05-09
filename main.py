#!/usr/bin/env python3
"""
抖音直播间弹幕助手 v2.0
- 实时读取弹幕
- 智能自动回复
- 简单易用
"""

import json
import re
import sys
import time
import uuid
import requests
from pathlib import Path
from datetime import datetime
from collections import deque
import threading

import websocket

try:
    from rich.console import Console
    HAS_RICH = True
except ImportError:
    HAS_RICH = False

class Config:
    """配置文件管理"""
    def __init__(self):
        self.config_dir = Path(__file__).parent / "data"
        self.config_dir.mkdir(exist_ok=True, parents=True)
        self.config_file = self.config_dir / "config.json"
        self.load()

    def load(self):
        if self.config_file.exists():
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    self.data = json.load(f)
            except:
                self.data = {}
        else:
            self.data = {}

        self.data.setdefault('cookie', '')
        self.data.setdefault('rules', [])
        self.data.setdefault('auto_reply', True)
        self.data.setdefault('reply_interval', 2)
        self.data.setdefault('blacklist', [])

    def save(self):
        with open(self.config_file, 'w', encoding='utf-8') as f:
            json.dump(self.data, f, ensure_ascii=False, indent=2)

    def get(self, key, default=None):
        return self.data.get(key, default)

    def set(self, key, value):
        self.data[key] = value
        self.save()

class DouyinLive:
    """抖音直播间连接"""
    def __init__(self):
        self.room_id = None
        self.ws = None
        self.is_connected = False
        self.running = False
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://live.douyin.com/',
        }
        self.on_danmu = None
        self.reply_queue = []
        self.reply_interval = 2

    def extract_room_id(self, url):
        url = url.strip()
        if url.isdigit() and len(url) >= 15:
            return url
        match = re.search(r'/(\d{15,})', url)
        if match: return match.group(1)
        match = re.search(r'(\d{15,})', url)
        if match: return match.group(1)
        return None

    def connect(self, room_id, cookie=None):
        room_id = self.extract_room_id(room_id)
        if not room_id:
            return False, "无效的房间号"

        self.room_id = room_id
        headers = self.headers.copy()

        if cookie:
            headers['Cookie'] = cookie

        try:
            response = requests.get(
                'https://live.douyin.com/webcast/im/fetch/',
                params={'room_id': room_id, 'type': '0'},
                headers=headers,
                timeout=15
            )

            if response.status_code != 200:
                return False, f"HTTP错误: {response.status_code}"

            if not response.text:
                return False, "服务器返回空响应，可能需要登录"

            data = response.json()
            ws_link = data.get('data', {}).get('ws_link')

            if not ws_link:
                return False, "无法获取弹幕链接，请检查Cookie是否有效"

            self._start_websocket(ws_link)
            return True, "连接成功"

        except requests.exceptions.Timeout:
            return False, "连接超时"
        except requests.exceptions.RequestException as e:
            return False, f"网络错误: {e}"
        except Exception as e:
            return False, f"连接失败: {e}"

    def _start_websocket(self, ws_link):
        self.running = True
        self.is_connected = True

        def on_message(ws, message):
            try:
                msg_data = json.loads(message)
                self._handle_message(msg_data)
            except:
                pass

        def on_error(ws, error):
            pass

        def on_close(ws, *args):
            self.is_connected = False

        def on_open(ws):
            threading.Thread(target=self._heartbeat, args=(ws,), daemon=True).start()
            threading.Thread(target=self._reply_worker, args=(ws,), daemon=True).start()

        self.ws = websocket.WebSocketApp(
            ws_link,
            on_message=on_message,
            on_error=on_error,
            on_close=on_close,
            on_open=on_open
        )
        threading.Thread(target=self.ws.run_forever, daemon=True).start()

    def _heartbeat(self, ws):
        while self.running and self.is_connected:
            try:
                ws.send(json.dumps({
                    'type': 'heartbeat',
                    'data': {'room_id': self.room_id, 'timestamp': int(time.time() * 1000)}
                }))
                time.sleep(20)
            except:
                break

    def _reply_worker(self, ws):
        while self.running:
            if self.reply_queue:
                content = self.reply_queue.pop(0)
                try:
                    ws.send(json.dumps({
                        'type': 'chat',
                        'data': {'content': content, 'room_id': self.room_id}
                    }))
                    time.sleep(self.reply_interval)
                except:
                    pass
            else:
                time.sleep(0.5)

    def _handle_message(self, msg_data):
        msg_type = msg_data.get('type', '')

        if msg_type == 'chat':
            danmu = {
                'id': str(msg_data.get('msg_id', '')),
                'user': msg_data.get('user', {}).get('nickname', '匿名'),
                'content': msg_data.get('content', ''),
                'time': datetime.now().strftime('%H:%M:%S'),
                'user_id': str(msg_data.get('user', {}).get('id', ''))
            }
            if self.on_danmu:
                self.on_danmu(danmu)

        elif msg_type == 'member':
            danmu = {
                'id': f"join_{msg_data.get('user', {}).get('id', '')}",
                'user': msg_data.get('user', {}).get('nickname', '访客'),
                'content': '进入了直播间',
                'time': datetime.now().strftime('%H:%M:%S'),
                'user_id': str(msg_data.get('user', {}).get('id', '')),
                'is_join': True
            }
            if self.on_danmu:
                self.on_danmu(danmu)

    def send_reply(self, content):
        if self.is_connected:
            self.reply_queue.append(content)
            return True
        return False

    def disconnect(self):
        self.running = False
        if self.ws:
            self.ws.close()
        self.is_connected = False

class AutoReply:
    """自动回复引擎"""
    def __init__(self, config):
        self.config = config
        self.stats = {'triggered': 0, 'replies': 0}

    def should_reply(self, danmu):
        if not self.config.get('auto_reply', True):
            return None

        user_id = danmu.get('user_id', '')
        if user_id in self.config.get('blacklist', []):
            return None

        content = danmu.get('content', '').lower()
        if not content or danmu.get('is_join'):
            return None

        rules = self.config.get('rules', [])
        for rule in rules:
            if not rule.get('enabled', True):
                continue

            keyword = rule.get('keyword', '').lower()
            if keyword and keyword in content:
                replies = rule.get('replies', [])
                if replies:
                    import random
                    reply = random.choice(replies)
                    self.stats['triggered'] += 1
                    self.stats['replies'] += 1
                    return reply

        return None

class CLI:
    """命令行界面"""
    def __init__(self):
        self.config = Config()
        self.douyin = DouyinLive()
        self.auto_reply = AutoReply(self.config)
        self.console = Console() if HAS_RICH else None
        self.danmu_history = deque(maxlen=500)
        self.stats = {'total': 0, 'joins': 0}
        self.running = False

    def p(self, msg, style=''):
        if style and HAS_RICH:
            print(f"[{style}]{msg}[/{style}]")
        else:
            print(msg)

    def print_banner(self):
        banner = """
╔══════════════════════════════════════════════════════════════╗
║         抖音直播间弹幕助手 v2.0                            ║
║                                                          ║
║  实时弹幕  |  智能回复  |  数据统计                     ║
╚══════════════════════════════════════════════════════════════╝
"""
        print(banner)

    def check_cookie(self):
        cookie = self.config.get('cookie', '')
        if not cookie:
            self.p("\n⚠️  尚未设置Cookie，无法连接直播间", "yellow")
            self.p("\n请先设置Cookie (选项 2)", "cyan")
            return False
        return True

    def connect_room(self):
        if not self.check_cookie():
            return

        print("\n请输入直播间链接或房间号:", end=" ")
        room_id = input().strip()

        if not room_id:
            self.p("房间号不能为空", "red")
            return

        self.p("\n正在连接...", "cyan")
        success, message = self.douyin.connect(room_id, self.config.get('cookie'))

        if success:
            self.p(f"✅ {message}", "green")
            self.start_monitor()
        else:
            self.p(f"❌ {message}", "red")
            if "登录" in message or "Cookie" in message:
                self.p("\n解决方案:", "yellow")
                self.p("1. Cookie可能已过期，请重新设置 (选项2)")
                self.p("2. 确保直播间正在直播中")

    def start_monitor(self):
        self.running = True
        self.stats = {'total': 0, 'joins': 0}
        self.danmu_history.clear()

        def on_danmu(danmu):
            self.danmu_history.append(danmu)
            self.stats['total'] += 1
            if danmu.get('is_join'):
                self.stats['joins'] += 1

            content = f"[{danmu['time']}] {danmu['user']}: {danmu['content']}"
            if danmu.get('is_join'):
                print(content)
            else:
                print(content)

            reply = self.auto_reply.should_reply(danmu)
            if reply:
                self.douyin.send_reply(reply)
                self.p(f"    └─ 🤖 自动回复: {reply}", "green")

        self.douyin.on_danmu = on_danmu

        self.p("\n" + "="*60, "cyan")
        self.p("监控中... 按 Ctrl+C 停止", "green")
        self.p("="*60, "cyan")

        try:
            while self.running and self.douyin.is_connected:
                time.sleep(1)
        except KeyboardInterrupt:
            self.stop_monitor()

    def stop_monitor(self):
        self.running = False
        self.douyin.disconnect()
        self.p("\n监控已停止", "yellow")
        self.p(f"本次: {self.stats['total']}条弹幕, {self.stats['joins']}人入场, {self.auto_reply.stats['replies']}条回复", "cyan")

    def setup_cookie(self):
        print("\n" + "="*60)
        print("设置Cookie - 快速获取方法:", "cyan")
        print("="*60)
        print("""
1. 打开浏览器访问 https://live.douyin.com/ 并登录
2. 按 F12 打开开发者工具
3. 切换到 Console 标签
4. 输入: copy(document.cookie) 并回车
5. 粘贴到下方
        """)

        print("请输入Cookie (直接回车跳过):", end=" ")
        cookie = input().strip()

        if cookie:
            self.config.set('cookie', cookie)
            self.p("✅ Cookie已保存!", "green")

            self.p("\n正在测试连接...", "cyan")
            success, msg = self.douyin.connect("1", cookie)
            self.douyin.disconnect()

            if success:
                self.p("✅ Cookie有效!", "green")
            else:
                self.p(f"⚠️  Cookie可能无效: {msg}", "yellow")
        else:
            self.p("已跳过", "yellow")

    def manage_rules(self):
        while True:
            print("\n" + "="*60)
            print("回复规则管理", "cyan")
            print("="*60)

            rules = self.config.get('rules', [])

            if not rules:
                print("\n暂无规则，建议导入预设规则!")
            else:
                print(f"\n共 {len(rules)} 条规则:")
                for i, rule in enumerate(rules, 1):
                    status = "✓" if rule.get('enabled', True) else "✗"
                    keyword = rule.get('keyword', '')
                    replies = rule.get('replies', [])
                    print(f"  {i}. [{status}] {keyword} → {replies[0] if replies else ''}")

            print("\n操作:")
            print("  1. 添加规则")
            print("  2. 删除规则")
            print("  3. 导入预设规则 (推荐)")
            print("  0. 返回")

            choice = input("\n请选择: ").strip()

            if choice == '1':
                self.add_rule()
            elif choice == '2':
                self.delete_rule()
            elif choice == '3':
                self.import_preset_rules()
            elif choice == '0':
                break

    def add_rule(self):
        print("\n添加回复规则")
        keyword = input("触发关键词: ").strip()
        if not keyword:
            self.p("关键词不能为空", "red")
            return

        print("回复内容 (多条用|分隔):", end=" ")
        replies_input = input().strip()
        if not replies_input:
            self.p("回复内容不能为空", "red")
            return

        replies = [r.strip() for r in replies_input.split('|') if r.strip()]

        rule = {
            'id': str(uuid.uuid4())[:8],
            'keyword': keyword,
            'replies': replies,
            'enabled': True
        }

        rules = self.config.get('rules', [])
        rules.append(rule)
        self.config.set('rules', rules)

        self.p("✅ 规则添加成功!", "green")

    def delete_rule(self):
        rules = self.config.get('rules', [])
        if not rules:
            print("暂无规则")
            return

        try:
            idx = int(input("输入要删除的编号: ").strip()) - 1
            if 0 <= idx < len(rules):
                rules.pop(idx)
                self.config.set('rules', rules)
                self.p("✅ 已删除", "green")
            else:
                self.p("无效编号", "red")
        except ValueError:
            self.p("请输入数字", "red")

    def import_preset_rules(self):
        presets = [
            ("价格", ["请点击主页查看商品链接", "私信客服获取报价"]),
            ("发货", ["本店48小时内发货", "按付款顺序发货，请耐心等待"]),
            ("优惠", ["关注店铺领取优惠券", "满100减10，点击领取"]),
            ("尺码", ["请参考详情页尺码表", "建议比平时买大一码"]),
            ("质量", ["本店商品均为正品", "7天无理由退换货"]),
            ("怎么买", ["点击下方购物车即可购买", "直接点击链接下单"]),
            ("有货吗", ["有货的，亲可以放心购买", "库存充足，欢迎下单"]),
        ]

        print("\n选择预设规则 (输入编号，多个用逗号分隔):")
        for i, (keyword, replies) in enumerate(presets, 1):
            print(f"  {i}. {keyword}: {' | '.join(replies)}")

        print("\n  a. 导入全部")
        choice = input("请选择: ").strip()

        if not choice:
            return

        rules = self.config.get('rules', [])

        if choice.lower() == 'a':
            indices = list(range(len(presets)))
        else:
            try:
                indices = [int(x.strip()) - 1 for x in choice.split(',')]
            except ValueError:
                self.p("输入格式错误", "red")
                return

        added = 0
        for idx in indices:
            if 0 <= idx < len(presets):
                keyword, replies = presets[idx]
                if not any(r.get('keyword') == keyword for r in rules):
                    rules.append({
                        'id': str(uuid.uuid4())[:8],
                        'keyword': keyword,
                        'replies': replies,
                        'enabled': True
                    })
                    added += 1

        self.config.set('rules', rules)
        self.p(f"✅ 已导入 {added} 条规则", "green")

    def show_settings(self):
        print("\n" + "="*60)
        print("设置", "cyan")
        print("="*60)

        auto_reply = self.config.get('auto_reply', True)
        interval = self.config.get('reply_interval', 2)
        blacklist = self.config.get('blacklist', [])

        self.p(f"\n1. 自动回复: {'开启' if auto_reply else '关闭'}")
        self.p(f"2. 回复间隔: {interval}秒")
        self.p(f"3. 黑名单人数: {len(blacklist)}")

        print("\n操作:")
        print("  1. 开关自动回复")
        print("  2. 设置回复间隔")
        print("  3. 查看/管理黑名单")
        print("  0. 返回")

        choice = input("\n请选择: ").strip()

        if choice == '1':
            current = self.config.get('auto_reply', True)
            self.config.set('auto_reply', not current)
            self.p(f"自动回复已{'关闭' if current else '开启'}", "green")
        elif choice == '2':
            try:
                interval = int(input("输入间隔秒数: ").strip())
                if interval >= 1:
                    self.config.set('reply_interval', interval)
                    self.douyin.reply_interval = interval
                    self.p("已设置", "green")
            except ValueError:
                self.p("请输入数字", "red")
        elif choice == '3':
            self.manage_blacklist()

    def manage_blacklist(self):
        blacklist = self.config.get('blacklist', [])
        print("\n黑名单管理")
        if blacklist:
            print(f"当前黑名单 ({len(blacklist)}人):")
            for i, uid in enumerate(blacklist, 1):
                print(f"  {i}. {uid}")
        else:
            print("黑名单为空")

        print("\n  1. 添加用户到黑名单")
        print("  2. 从黑名单移除")
        print("  0. 返回")

        choice = input("\n请选择: ").strip()

        if choice == '1':
            uid = input("输入用户ID: ").strip()
            if uid and uid not in blacklist:
                blacklist.append(uid)
                self.config.set('blacklist', blacklist)
                self.p("✅ 已添加到黑名单", "green")
        elif choice == '2':
            try:
                idx = int(input("输入编号: ").strip()) - 1
                if 0 <= idx < len(blacklist):
                    blacklist.pop(idx)
                    self.config.set('blacklist', blacklist)
                    self.p("✅ 已从黑名单移除", "green")
            except ValueError:
                self.p("请输入数字", "red")

    def show_history(self):
        print("\n" + "="*60)
        print("弹幕历史", "cyan")
        print("="*60)

        history = list(self.danmu_history)[-30:]

        if not history:
            print("\n暂无弹幕")
            return

        for danmu in reversed(history):
            if danmu.get('is_join'):
                print(f"[{danmu['time']}] {danmu['user']} {danmu['content']}")
            else:
                print(f"[{danmu['time']}] {danmu['user']}: {danmu['content']}")

    def run(self):
        self.print_banner()

        cookie = self.config.get('cookie', '')
        if cookie:
            self.p("✅ 已检测到保存的Cookie", "green")
        else:
            self.p("⚠️  尚未设置Cookie", "yellow")

        rules = self.config.get('rules', [])
        if rules:
            self.p(f"✅ 已加载 {len(rules)} 条回复规则", "green")

        while True:
            print("\n" + "-"*60)
            print("主菜单", "cyan")
            print("-"*60)
            print("  1. 连接直播间")
            print("  2. 设置Cookie")
            print("  3. 管理回复规则")
            print("  4. 设置")
            print("  5. 查看历史")
            print("  0. 退出")

            choice = input("\n请选择: ").strip()

            if choice == '1':
                self.connect_room()
            elif choice == '2':
                self.setup_cookie()
            elif choice == '3':
                self.manage_rules()
            elif choice == '4':
                self.show_settings()
            elif choice == '5':
                self.show_history()
            elif choice == '0':
                if self.douyin.is_connected:
                    self.douyin.disconnect()
                self.p("\n感谢使用! 👋", "cyan")
                break

if __name__ == '__main__':
    try:
        cli = CLI()
        cli.run()
    except KeyboardInterrupt:
        print("\n\n程序已退出")
        sys.exit(0)
