#!/usr/bin/env python3
"""
抖音直播间弹幕机器人 v3.0
专业级弹幕监控与自动回复系统
"""

import os
import sys
import json
import re
import time
import uuid
import requests
import websocket
from datetime import datetime
from pathlib import Path
from collections import deque
import threading

class Config:
    def __init__(self):
        self.config_dir = Path("data")
        self.config_dir.mkdir(exist_ok=True, parents=True)
        self.config_file = self.config_dir / "bot_config.json"
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
        self.data.setdefault('room_id', '')
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

class DanmuBot:
    def __init__(self):
        self.room_id = None
        self.ws = None
        self.connected = False
        self.running = False
        self.on_message = None
        self.reply_queue = deque(maxlen=100)
        self.reply_interval = 2
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://live.douyin.com/',
        }

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
            return False, "Invalid room ID"

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
                return False, f"HTTP error: {response.status_code}"
            if not response.text:
                return False, "Empty response, check Cookie"
            data = response.json()
            ws_link = data.get('data', {}).get('ws_link')
            if not ws_link:
                return False, "Cannot get danmu link, check Cookie"

            self._start_ws(ws_link)
            return True, "Connected successfully"

        except Exception as e:
            return False, f"Connection failed: {e}"

    def _start_ws(self, ws_link):
        self.running = True
        self.connected = True

        def on_msg(ws, msg):
            try:
                data = json.loads(msg)
                self._handle_msg(data)
            except: pass

        def on_err(ws, err): pass
        def on_close(ws, *args):
            self.connected = False

        def on_open(ws):
            threading.Thread(target=self._heartbeat, args=(ws,), daemon=True).start()
            threading.Thread(target=self._send_replies, args=(ws,), daemon=True).start()

        self.ws = websocket.WebSocketApp(
            ws_link,
            on_message=on_msg,
            on_error=on_err,
            on_close=on_close,
            on_open=on_open
        )
        threading.Thread(target=self.ws.run_forever, daemon=True).start()

    def _heartbeat(self, ws):
        while self.running and self.connected:
            try:
                ws.send(json.dumps({
                    'type': 'heartbeat',
                    'data': {'room_id': self.room_id, 'timestamp': int(time.time() * 1000)}
                }))
                time.sleep(20)
            except: break

    def _send_replies(self, ws):
        while self.running:
            if self.reply_queue:
                content = self.reply_queue.popleft()
                try:
                    ws.send(json.dumps({
                        'type': 'chat',
                        'data': {'content': content, 'room_id': self.room_id}
                    }))
                    time.sleep(self.reply_interval)
                except: pass
            else:
                time.sleep(0.3)

    def _handle_msg(self, data):
        msg_type = data.get('type', '')
        if msg_type == 'chat':
            danmu = {
                'id': str(data.get('msg_id', '')),
                'user_id': str(data.get('user', {}).get('id', '')),
                'user': data.get('user', {}).get('nickname', 'User'),
                'content': data.get('content', ''),
                'time': datetime.now().strftime('%H:%M:%S'),
                'type': 'danmu'
            }
            if self.on_message:
                self.on_message(danmu)
        elif msg_type == 'member':
            danmu = {
                'id': f"join_{data.get('user', {}).get('id', '')}",
                'user_id': str(data.get('user', {}).get('id', '')),
                'user': data.get('user', {}).get('nickname', 'Guest'),
                'content': 'Joined live',
                'time': datetime.now().strftime('%H:%M:%S'),
                'type': 'join'
            }
            if self.on_message:
                self.on_message(danmu)

    def send_reply(self, content):
        if self.connected:
            self.reply_queue.append(content)
            return True
        return False

    def disconnect(self):
        self.running = False
        if self.ws:
            self.ws.close()
        self.connected = False

class RobotPanel:
    def __init__(self):
        self.config = Config()
        self.bot = DanmuBot()
        self.danmu_list = deque(maxlen=12)
        self.stats = {'total': 0, 'joins': 0, 'replies': 0}
        self.auto_reply_enabled = True
        self.reply_interval = 2
        self.last_update = 0

    def clear_screen(self):
        os.system('cls' if os.name == 'nt' else 'clear')

    def draw_panel(self):
        self.clear_screen()

        status = "[CONNECTED]" if self.bot.connected else "[OFFLINE]"
        auto = "ON" if self.auto_reply_enabled else "OFF"

        room_display = self.config.get('room_id', 'Not set')
        if len(room_display) > 25:
            room_display = room_display[:22] + "..."

        width = 70
        print("=" * width)
        print(f"|{'DOUYIN LIVE DANMU BOT v3.0':^{width-20}}|{status:^18}|")
        print("=" * width)
        print(f"| Total: {self.stats['total']:>4}  Joins: {self.stats['joins']:>4}  Replies: {self.stats['replies']:>4}  AutoReply: {auto:<3} |")
        print("-" * width)
        print(f"| Room: {room_display:<60}|")
        print("-" * width)
        print(f"|{'REAL-TIME DANMU WALL':^68}|")
        print("-" * width)

        if not self.danmu_list:
            print(f"|{'[ Waiting for danmu... ]':^68}|")
        else:
            for danmu in list(self.danmu_list)[-12:]:
                danmu_type = danmu.get('type', 'danmu')
                ts = danmu.get('time', '')
                user = danmu.get('user', 'User')
                content = danmu.get('content', '')

                if len(user) > 12:
                    user = user[:10] + ".."
                if len(content) > 40:
                    content = content[:37] + "..."

                if danmu_type == 'join':
                    line = f"[{ts}] * {user} {content}"
                else:
                    line = f"[{ts}] {user}: {content}"

                line_len = len(line.encode('utf-8'))
                padding = width - 2 - line_len
                if danmu_type == 'join':
                    print(f"|\033[36m{line}\033[0m" + " " * padding + "|")
                else:
                    print(f"|\033[32m{line}\033[0m" + " " * padding + "|")

        print("-" * width)
        print(f"| Commands: [1]Connect [2]Disconnect [3]Set Cookie [4]Rules [5]Toggle Auto [0]Exit |")
        print("=" * width)

        if self.bot.reply_queue:
            print(f"\n[Reply Queue: {len(self.bot.reply_queue)} waiting]")

    def handle_danmu(self, danmu):
        self.danmu_list.append(danmu)

        if danmu.get('type') == 'join':
            self.stats['joins'] += 1
        else:
            self.stats['total'] += 1

            if self.auto_reply_enabled:
                reply = self.check_rules(danmu)
                if reply:
                    self.bot.send_reply(reply)
                    self.stats['replies'] += 1
                    danmu['replied'] = True

    def check_rules(self, danmu):
        user_id = danmu.get('user_id', '')
        if user_id in self.config.get('blacklist', []):
            return None

        content = danmu.get('content', '').lower()
        if not content:
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
                    return random.choice(replies)
        return None

    def connect_room(self):
        room_id = self.config.get('room_id', '')
        cookie = self.config.get('cookie', '')

        if not cookie:
            print("\n[ERROR] Please set Cookie first!")
            input("Press Enter to continue...")
            return

        if not room_id:
            print("\nEnter room URL or ID: ", end="")
            room_id = input().strip()
            if room_id:
                self.config.set('room_id', room_id)

        if not room_id:
            return

        print(f"\nConnecting to {room_id}...")

        success, msg = self.bot.connect(room_id, cookie)

        if success:
            self.stats = {'total': 0, 'joins': 0, 'replies': 0}
            self.danmu_list.clear()
            self.bot.on_message = self.handle_danmu
            print(f"[OK] {msg}")
        else:
            print(f"[ERROR] {msg}")

        input("Press Enter to continue...")

    def disconnect(self):
        self.bot.disconnect()
        print("\n[INFO] Disconnected")
        input("Press Enter to continue...")

    def set_cookie(self):
        print("\n" + "=" * 50)
        print("SET COOKIE")
        print("=" * 50)
        print("""
How to get Cookie:
1. Open https://live.douyin.com/ and login
2. Press F12 -> Console
3. Type: copy(document.cookie)
4. Paste below
""")

        cookie = input("Enter Cookie (Enter to clear): ").strip()

        if cookie:
            self.config.set('cookie', cookie)
            print("[OK] Cookie saved")
        else:
            self.config.set('cookie', '')
            print("[INFO] Cookie cleared")

        input("Press Enter to continue...")

    def manage_rules(self):
        while True:
            self.clear_screen()
            rules = self.config.get('rules', [])

            print("\n" + "=" * 50)
            print("REPLY RULES MANAGER")
            print("=" * 50 + "\n")

            if not rules:
                print("[No rules configured]")
            else:
                for i, rule in enumerate(rules, 1):
                    status = "[ON]" if rule.get('enabled', True) else "[OFF]"
                    kw = rule.get('keyword', '')
                    rp = rule.get('replies', [])[0] if rule.get('replies', []) else ''
                    print(f"  {i}. {status} {kw} -> {rp}")

            print("\n" + "-" * 50)
            print(" [1] Add Rule   [2] Delete   [3] Import Presets")
            print(" [4] Toggle     [0] Back")
            print("-" * 50)

            choice = input("\nChoice: ").strip()

            if choice == '1':
                self.add_rule()
            elif choice == '2':
                self.delete_rule(rules)
            elif choice == '3':
                self.import_presets()
            elif choice == '4':
                self.toggle_rule(rules)
            elif choice == '0':
                break

    def add_rule(self):
        print("\nADD RULE")
        keyword = input("  Keyword: ").strip()
        if not keyword:
            print("[ERROR] Keyword required")
            return

        replies_input = input("  Reply (multi with |): ").strip()
        if not replies_input:
            print("[ERROR] Reply required")
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

        print("[OK] Rule added")

    def delete_rule(self, rules):
        if not rules:
            return
        try:
            idx = int(input("  Enter number: ").strip()) - 1
            if 0 <= idx < len(rules):
                rules.pop(idx)
                self.config.set('rules', rules)
                print("[OK] Deleted")
        except ValueError:
            print("[ERROR] Enter a number")

    def import_presets(self):
        presets = [
            ("price", ["Check product link on profile", "DM for price"]),
            ("shipping", ["Ships within 48 hours", "Ships in order of payment"]),
            ("discount", ["Follow for coupons", "100-10 discount available"]),
            ("size", ["Check size chart in description", "Recommend one size up"]),
            ("quality", ["100% authentic", "7-day return policy"]),
            ("buy", ["Click cart below to buy", "Use link to order"]),
            ("stock", ["In stock, feel free to order", "Plenty available"]),
        ]

        print("\nIMPORT PRESETS (comma for multiple, a=all):")
        for i, (k, r) in enumerate(presets, 1):
            print(f"  {i}. {k}: {' | '.join(r)}")

        choice = input("\nChoice: ").strip()
        if not choice:
            return

        rules = self.config.get('rules', [])

        if choice.lower() == 'a':
            indices = range(len(presets))
        else:
            try:
                indices = [int(x.strip()) - 1 for x in choice.split(',')]
            except ValueError:
                print("[ERROR] Invalid format")
                return

        added = 0
        for idx in indices:
            if 0 <= idx < len(presets):
                k, r = presets[idx]
                if not any(x.get('keyword') == k for x in rules):
                    rules.append({
                        'id': str(uuid.uuid4())[:8],
                        'keyword': k,
                        'replies': r,
                        'enabled': True
                    })
                    added += 1

        self.config.set('rules', rules)
        print(f"[OK] Imported {added} rules")

    def toggle_rule(self, rules):
        if not rules:
            return
        try:
            idx = int(input("  Enter number: ").strip()) - 1
            if 0 <= idx < len(rules):
                rules[idx]['enabled'] = not rules[idx]['enabled']
                self.config.set('rules', rules)
                status = "ON" if rules[idx]['enabled'] else "OFF"
                print(f"[OK] Rule is now {status}")
        except ValueError:
            print("[ERROR] Enter a number")

    def toggle_auto_reply(self):
        self.auto_reply_enabled = not self.auto_reply_enabled
        status = "ON" if self.auto_reply_enabled else "OFF"
        print(f"\n[OK] Auto reply is now {status}")
        input("Press Enter to continue...")

    def run(self):
        while True:
            self.draw_panel()

            choice = input("\nCommand: ").strip()

            if choice == '1':
                self.connect_room()
            elif choice == '2':
                self.disconnect()
            elif choice == '3':
                self.set_cookie()
            elif choice == '4':
                self.manage_rules()
            elif choice == '5':
                self.toggle_auto_reply()
            elif choice == '0':
                if self.bot.connected:
                    self.bot.disconnect()
                print("\n[INFO] Thanks for using!")
                break

if __name__ == '__main__':
    try:
        panel = RobotPanel()
        panel.run()
    except KeyboardInterrupt:
        print("\n\n[INFO] Exited")
        sys.exit(0)
