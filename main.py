import asyncio
import json
import re
import sys
import time
import uuid
import websocket
import requests
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional
import threading
from collections import deque

try:
    from rich.console import Console
    from rich.table import Table
    from rich.live import Live
    from rich.panel import Panel
    from rich.prompt import Prompt, Confirm
    from rich.layout import Layout
    from rich import box
    HAS_RICH = True
except ImportError:
    HAS_RICH = False

class Database:
    def __init__(self):
        self.db_path = Path(__file__).parent / "data" / "danmu.db"
        self.db_path.parent.mkdir(exist_ok=True)
        self.danmu_history = deque(maxlen=1000)
        self.rules = []
        self.reply_history = []
        self._load_data()

    def _load_data(self):
        history_file = self.db_path.parent / "history.json"
        rules_file = self.db_path.parent / "rules.json"

        if history_file.exists():
            try:
                with open(history_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.danmu_history = deque(data.get('danmu', [])[-1000:], maxlen=1000)
                    self.reply_history = data.get('replies', [])
            except:
                pass

        if rules_file.exists():
            try:
                with open(rules_file, 'r', encoding='utf-8') as f:
                    self.rules = json.load(f)
            except:
                self.rules = []

    def _save_data(self):
        history_file = self.db_path.parent / "history.json"
        rules_file = self.db_path.parent / "rules.json"

        with open(history_file, 'w', encoding='utf-8') as f:
            json.dump({
                'danmu': list(self.danmu_history),
                'replies': self.reply_history[-100:]
            }, f, ensure_ascii=False, indent=2)

        with open(rules_file, 'w', encoding='utf-8') as f:
            json.dump(self.rules, f, ensure_ascii=False, indent=2)

    def save_danmu(self, danmu: Dict):
        self.danmu_history.append(danmu)
        self._save_data()

    def save_reply(self, danmu_id: str, reply: str):
        self.reply_history.append({
            'danmu_id': danmu_id,
            'reply': reply,
            'time': datetime.now().strftime('%H:%M:%S')
        })
        self._save_data()

    def add_rule(self, keyword: str, reply: str):
        rule_id = str(uuid.uuid4())[:8]
        self.rules.append({
            'id': rule_id,
            'keyword': keyword,
            'reply': reply,
            'enabled': True
        })
        self._save_data()
        return True

    def delete_rule(self, rule_id: str):
        self.rules = [r for r in self.rules if r['id'] != rule_id]
        self._save_data()

    def get_rules(self):
        return self.rules

    def get_recent_danmu(self, count: int = 50):
        return list(self.danmu_history)[-count:]

class DouyinLive:
    def __init__(self, console):
        self.console = console
        self.room_id = None
        self.ws = None
        self.is_connected = False
        self.running = False
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Referer': 'https://live.douyin.com/',
        }
        self.on_danmu = None
        self.reply_queue = []
        self.reply_interval = 2
        self.last_reply_time = {}

    def extract_room_id(self, input_str: str) -> Optional[str]:
        input_str = input_str.strip()

        if input_str.isdigit() and len(input_str) >= 15:
            return input_str

        match = re.search(r'/(\d{15,})', input_str)
        if match:
            return match.group(1)

        match = re.search(r'room_id=(\d+)', input_str)
        if match:
            return match.group(1)

        match = re.search(r'(\d{15,})', input_str)
        if match:
            return match.group(1)

        return None

    def connect(self, room_id: str) -> bool:
        room_id = self.extract_room_id(room_id)
        if not room_id:
            return False

        self.room_id = room_id
        self.console.print(f"[cyan]正在连接直播间...[/cyan]")

        try:
            params = {'room_id': room_id, 'type': '0'}
            response = requests.get(
                'https://live.douyin.com/webcast/im/fetch/',
                params=params,
                headers=self.headers,
                timeout=10
            )

            if response.status_code != 200:
                return False

            data = response.json()
            ws_link = data.get('data', {}).get('ws_link')

            if not ws_link:
                return False

            self._connect_websocket(ws_link)
            return True

        except Exception as e:
            self.console.print(f"[red]连接失败: {e}[/red]")
            return False

    def _connect_websocket(self, ws_link: str):
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
            self.is_connected = True
            threading.Thread(target=self._heartbeat, args=(ws,), daemon=True).start()
            threading.Thread(target=self._reply_worker, args=(ws,), daemon=True).start()

        self.ws = websocket.WebSocketApp(
            ws_link,
            on_message=on_message,
            on_error=on_error,
            on_close=on_close,
            on_open=on_open
        )

        thread = threading.Thread(target=self.ws.run_forever, daemon=True)
        thread.start()

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

    def _handle_message(self, msg_data: Dict):
        msg_type = msg_data.get('type', '')

        if msg_type == 'chat':
            danmu = {
                'id': str(msg_data.get('msg_id', '')),
                'user': msg_data.get('user', {}).get('nickname', '匿名'),
                'content': msg_data.get('content', ''),
                'time': datetime.now().strftime('%H:%M:%S'),
                'replied': False
            }
            if self.on_danmu:
                self.on_danmu(danmu)

        elif msg_type == 'member':
            join_info = {
                'id': f"join_{msg_data.get('user', {}).get('id', '')}",
                'user': msg_data.get('user', {}).get('nickname', '访客'),
                'content': '进入了直播间',
                'time': datetime.now().strftime('%H:%M:%S'),
                'replied': False,
                'is_join': True
            }
            if self.on_danmu:
                self.on_danmu(join_info)

    def send_reply(self, content: str):
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
    def __init__(self, database):
        self.database = database
        self.enabled = True

    def match_and_reply(self, danmu: Dict) -> Optional[str]:
        if not self.enabled or danmu.get('is_join'):
            return None

        content = danmu.get('content', '').lower()

        for rule in self.database.get_rules():
            if not rule.get('enabled', True):
                continue

            keyword = rule.get('keyword', '').lower()

            if keyword in content:
                reply = rule.get('reply', '')
                if reply:
                    self.database.save_reply(danmu.get('id', ''), reply)
                    return reply

        return None

class CLIApp:
    def __init__(self):
        self.console = Console() if HAS_RICH else None
        self.database = Database()
        self.douyin = DouyinLive(self.console)
        self.auto_reply = AutoReply(self.database)

        self.danmu_buffer = deque(maxlen=100)
        self.running = False
        self.danmu_count = 0
        self.reply_count = 0

    def print(self, msg, style=''):
        if self.console:
            if style:
                self.console.print(msg, style=style)
            else:
                print(msg)
        else:
            print(msg)

    def print_banner(self):
        banner = """
╔═══════════════════════════════════════════════════════╗
║          抖音直播间弹幕助手 v1.0 (CLI)                  ║
║                                                       ║
║  实时读取弹幕 | 自动回复 | 规则管理                    ║
╚═══════════════════════════════════════════════════════╝
        """
        self.print(banner)

    def show_menu(self):
        menu = """
操作菜单:
  1. 连接直播间
  2. 添加回复规则
  3. 查看规则列表
  4. 删除规则
  5. 开关自动回复
  6. 查看弹幕历史
  7. 导出数据
  0. 退出程序
        """
        self.print(menu)

    def connect_room(self):
        self.print("\n[提示] 请输入直播间链接或房间号", style='cyan')
        room_id = input("> ").strip()

        if not room_id:
            self.print("[错误] 房间号不能为空", style='red')
            return

        if self.douyin.connect(room_id):
            self.print("[成功] 已连接到直播间!", style='green')
            self.print("[提示] 按 Ctrl+C 可以暂停监控，返回菜单", style='yellow')
            return True
        else:
            self.print("[错误] 连接失败，请检查房间号是否正确", style='red')
            return False

    def add_rule(self):
        self.print("\n[添加回复规则]", style='cyan')
        keyword = input("请输入触发关键词: ").strip()
        reply = input("请输入回复内容: ").strip()

        if not keyword or not reply:
            self.print("[错误] 关键词和回复内容都不能为空", style='red')
            return

        if self.database.add_rule(keyword, reply):
            self.print("[成功] 规则添加成功!", style='green')
        else:
            self.print("[错误] 规则添加失败", style='red')

    def list_rules(self):
        rules = self.database.get_rules()

        if not rules:
            self.print("\n[提示] 暂无回复规则", style='yellow')
            return

        self.print(f"\n{'='*60}", style='cyan')
        self.print(f"{'规则列表':^60}", style='bold cyan')
        self.print(f"{'='*60}", style='cyan')

        for i, rule in enumerate(rules, 1):
            status = "[启用]" if rule.get('enabled', True) else "[禁用]"
            self.print(f"\n{i}. {status}")
            self.print(f"   关键词: {rule.get('keyword', '')}")
            self.print(f"   回复: {rule.get('reply', '')}")
            self.print(f"   ID: {rule.get('id', '')}")

    def delete_rule(self):
        rules = self.database.get_rules()

        if not rules:
            self.print("\n[提示] 暂无回复规则", style='yellow')
            return

        self.list_rules()
        self.print("\n请输入要删除的规则编号或ID: ", style='cyan', end='')

        choice = input().strip()

        rule_id = None
        if choice.isdigit():
            idx = int(choice) - 1
            if 0 <= idx < len(rules):
                rule_id = rules[idx]['id']
        else:
            rule_id = choice

        if rule_id:
            self.database.delete_rule(rule_id)
            self.print("[成功] 规则已删除", style='green')
        else:
            self.print("[错误] 无效的选择", style='red')

    def toggle_auto_reply(self):
        self.auto_reply.enabled = not self.auto_reply.enabled
        status = "启用" if self.auto_reply.enabled else "禁用"
        self.print(f"[提示] 自动回复已{status}", style='green' if self.auto_reply.enabled else 'yellow')

    def show_history(self):
        history = self.database.get_recent_danmu(50)

        if not history:
            self.print("\n[提示] 暂无弹幕历史", style='yellow')
            return

        self.print(f"\n{'='*60}", style='cyan')
        self.print(f"{'弹幕历史 (最近50条)':^60}", style='bold cyan')
        self.print(f"{'='*60}", style='cyan')

        for danmu in reversed(history):
            if danmu.get('is_join'):
                self.print(f"[{danmu['time']}] {danmu['user']} {danmu['content']}", style='dim')
            else:
                replied = "[已回复]" if danmu.get('replied') else ""
                self.print(f"[{danmu['time']}] {danmu['user']}: {danmu['content']} {replied}")

    def export_data(self):
        self.print("\n正在导出数据...", style='cyan')

        export_file = Path(__file__).parent / "data" / f"export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

        data = {
            'danmu_history': list(self.database.danmu_history),
            'reply_history': self.database.reply_history,
            'rules': self.database.rules,
            'export_time': datetime.now().isoformat()
        }

        try:
            with open(export_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            self.print(f"[成功] 数据已导出到: {export_file}", style='green')
        except Exception as e:
            self.print(f"[错误] 导出失败: {e}", style='red')

    def start_monitoring(self):
        self.running = True
        self.danmu_count = 0
        self.reply_count = 0

        def on_danmu(danmu):
            self.database.save_danmu(danmu)
            self.danmu_count += 1

            if not danmu.get('is_join'):
                if self.console:
                    self.console.print(f"[{danmu['time']}] {danmu['user']}: {danmu['content']}")

                reply = self.auto_reply.match_and_reply(danmu)
                if reply:
                    self.douyin.send_reply(reply)
                    self.reply_count += 1
                    danmu['replied'] = True
                    if self.console:
                        self.console.print(f"    [自动回复] {reply}", style='green')

        self.douyin.on_danmu = on_danmu

        self.print("\n[监控中] 正在监听弹幕...", style='bold green')
        self.print(f"[统计] 弹幕: {self.danmu_count} | 回复: {self.reply_count} | 自动回复: {'开启' if self.auto_reply.enabled else '关闭'}", style='dim')
        self.print("按 Ctrl+C 停止监听\n", style='dim')

        try:
            while self.running and self.douyin.is_connected:
                time.sleep(1)
        except KeyboardInterrupt:
            self.stop_monitoring()

    def stop_monitoring(self):
        self.running = False
        self.douyin.disconnect()
        self.print("\n[提示] 监控已停止", style='yellow')
        self.print(f"[统计] 本次共捕获 {self.danmu_count} 条弹幕，发送 {self.reply_count} 条回复", style='cyan')

    def run(self):
        self.print_banner()

        while True:
            self.show_menu()
            choice = input("\n请选择操作 (0-7): ").strip()

            if choice == '1':
                if self.connect_room():
                    self.start_monitoring()

            elif choice == '2':
                self.add_rule()

            elif choice == '3':
                self.list_rules()

            elif choice == '4':
                self.delete_rule()

            elif choice == '5':
                self.toggle_auto_reply()

            elif choice == '6':
                self.show_history()

            elif choice == '7':
                self.export_data()

            elif choice == '0':
                if self.douyin.is_connected:
                    self.douyin.disconnect()
                self.print("\n[提示] 感谢使用，再见!", style='cyan')
                break

            else:
                self.print("\n[错误] 无效的选择，请输入 0-7", style='red')

if __name__ == '__main__':
    try:
        app = CLIApp()
        app.run()
    except KeyboardInterrupt:
        print("\n\n[提示] 程序已退出")
        sys.exit(0)
