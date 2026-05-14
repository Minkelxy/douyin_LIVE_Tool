#!/usr/bin/env python3
"""
抖音直播间弹幕机器人 v4.0 - 智能模块化版本
支持多种动作模块：点歌、查询、提醒、SillyTavern转发等
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
        self.config_file = self.config_dir / "bot_config_v4.json"
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
        self.data.setdefault('sillytavern_url', 'http://localhost:8000')

    def save(self):
        with open(self.config_file, 'w', encoding='utf-8') as f:
            json.dump(self.data, f, ensure_ascii=False, indent=2)

    def get(self, key, default=None):
        return self.data.get(key, default)

    def set(self, key, value):
        self.data[key] = value
        self.save()

class DouyinDanmu:
    def __init__(self):
        self.room_id = None
        self.ws = None
        self.connected = False
        self.running = False
        self.on_danmu = None
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
            return True, "Connected"

        except Exception as e:
            return False, f"Connection failed: {e}"

    def _start_ws(self, ws_link):
        self.running = True
        self.connected = True

        def on_msg(ws, message):
            try:
                data = json.loads(message)
                self._handle_msg(data)
            except: pass

        def on_error(ws, err): pass
        def on_close(ws, *args):
            self.connected = False

        def on_open(ws):
            threading.Thread(target=self._heartbeat, args=(ws,), daemon=True).start()

        self.ws = websocket.WebSocketApp(
            ws_link,
            on_message=on_msg,
            on_error=on_error,
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
            if self.on_danmu:
                self.on_danmu(danmu)
        elif msg_type == 'member':
            danmu = {
                'id': f"join_{data.get('user', {}).get('id', '')}",
                'user': data.get('user', {}).get('nickname', 'Guest'),
                'content': 'Joined',
                'time': datetime.now().strftime('%H:%M:%S'),
                'type': 'join'
            }
            if self.on_danmu:
                self.on_danmu(danmu)

    def disconnect(self):
        self.running = False
        if self.ws:
            self.ws.close()
        self.connected = False

class SillyTavernBridge:
    """SillyTavern桥接器"""

    def __init__(self, config):
        self.config = config
        self.base_url = config.get('sillytavern_url', 'http://localhost:8000').rstrip('/')
        self.session = requests.Session()
        self.enabled = True
        self.stats = {'sent': 0, 'failed': 0}

    def set_url(self, url):
        self.base_url = url.rstrip('/')
        self.config.set('sillytavern_url', url)

    def send_message(self, content, user=''):
        """发送消息到SillyTavern"""
        if not self.enabled:
            return False, "SillyTavern未启用"

        try:
            formatted = f"【{user}】{content}" if user else content

            endpoints = [
                f"{self.base_url}/api/backends/chat",
                f"{self.base_url}/api/chat",
                f"{self.base_url}/api/send",
            ]

            for endpoint in endpoints:
                try:
                    response = self.session.post(
                        endpoint,
                        json={'content': formatted, 'name': '弹幕用户'},
                        headers={'Content-Type': 'application/json'},
                        timeout=30
                    )
                    if response.status_code in [200, 201]:
                        self.stats['sent'] += 1
                        return True, "已转发到SillyTavern"
                except:
                    continue

            self.stats['failed'] += 1
            return False, "转发失败"

        except Exception as e:
            self.stats['failed'] += 1
            return False, f"转发失败: {e}"

    def check_connection(self):
        try:
            response = self.session.get(f"{self.base_url}/api/status", timeout=5)
            return response.status_code == 200
        except:
            return False

class ActionModules:
    """动作模块"""

    @staticmethod
    def music_player(params, context):
        """点歌模块"""
        song = params.get('song', '')
        artist = params.get('artist', '')

        result = {
            'success': True,
            'action': 'music_player',
            'message': '',
            'reply': ''
        }

        if not song:
            result['reply'] = '没听清歌名，能再说一遍吗？'
            return result

        if artist:
            result['message'] = f"🎵 点歌: {song} - {artist}"
            result['reply'] = f'收到啦~ 已为{context["user"]}点歌《{song}》- {artist}'
        else:
            result['message'] = f"🎵 点歌: {song}"
            result['reply'] = f'收到啦~ 已为{context["user"]}点歌《{song}》'

        return result

    @staticmethod
    def query_order(params, context):
        """查询订单"""
        result = {
            'success': True,
            'action': 'query_order',
            'message': '📦 查询订单',
            'reply': f'{context["user"]}，请私信客服查询订单哦~'
        }
        return result

    @staticmethod
    def reminder(params, context):
        """提醒"""
        result = {
            'success': True,
            'action': 'reminder',
            'message': f"⏰ 提醒已记录",
            'reply': f'好的~ 主播会注意的 ({context["user"]})'
        }
        return result

    @staticmethod
    def custom(params, context):
        """自定义回复"""
        reply = params.get('reply', '收到！')
        return {
            'success': True,
            'action': 'custom',
            'message': '💬 回复',
            'reply': reply
        }

    @staticmethod
    def forward_st(params, context, st_bridge):
        """转发到SillyTavern"""
        original_content = context.get('content', '')
        user = context.get('user', '用户')

        result = {
            'success': True,
            'action': 'forward_st',
            'message': '🤖 转发到SillyTavern',
            'reply': '',
            'need_forward': True,
            'forward_content': original_content,
            'forward_user': user
        }
        return result

class SmartRule:
    """智能规则"""

    def __init__(self, rule_data):
        self.id = rule_data.get('id', str(uuid.uuid4())[:8])
        self.name = rule_data.get('name', '未命名规则')
        self.triggers = rule_data.get('triggers', [])
        self.pattern = rule_data.get('pattern', '')
        self.module = rule_data.get('module', 'custom')
        self.params = rule_data.get('params', {})
        self.enabled = rule_data.get('enabled', True)

    def match(self, content):
        if not self.enabled:
            return False

        content_lower = content.lower()

        if self.triggers:
            for trigger in self.triggers:
                if trigger.lower() in content_lower:
                    return True

        if self.pattern:
            try:
                if re.search(self.pattern, content, re.IGNORECASE):
                    return True
            except:
                pass

        return False

    def parse(self, content):
        params = {}

        if not self.pattern:
            return params

        try:
            match = re.search(self.pattern, content, re.IGNORECASE)
            if match:
                params = match.groupdict()
                if params:
                    params = {k: v.strip() if v else '' for k, v in params.items()}
                else:
                    for i, g in enumerate(match.groups()):
                        params[f'param{i+1}'] = g.strip() if g else ''
        except:
            pass

        return params

    def execute(self, context, st_bridge=None):
        module_func = getattr(ActionModules, self.module, None)

        if module_func:
            if self.module == 'forward_st' and st_bridge:
                result = module_func(self.params, context, st_bridge)
            else:
                result = module_func(self.params, context)

            if result.get('need_forward') and st_bridge:
                success, msg = st_bridge.send_message(
                    result.get('forward_content', ''),
                    result.get('forward_user', '')
                )
                result['forward_success'] = success
                result['forward_msg'] = msg

            return result

        return {'success': False, 'reply': ''}

class RobotPanel:
    def __init__(self):
        self.config = Config()
        self.douyin = DouyinDanmu()
        self.st_bridge = SillyTavernBridge(self.config)
        self.danmu_list = deque(maxlen=10)
        self.action_log = deque(maxlen=20)
        self.stats = {'total': 0, 'joins': 0, 'actions': 0, 'forwarded': 0}
        self.auto_reply_enabled = True
        self.rules = []
        self.load_rules()

    def load_rules(self):
        rules_data = self.config.get('rules', [])
        if not rules_data:
            rules_data = self.get_default_rules()
            self.config.set('rules', rules_data)
        self.rules = [SmartRule(r) for r in rules_data]

    def save_rules(self):
        rules_data = []
        for rule in self.rules:
            rules_data.append({
                'id': rule.id,
                'name': rule.name,
                'triggers': rule.triggers,
                'pattern': rule.pattern,
                'module': rule.module,
                'params': rule.params,
                'enabled': rule.enabled
            })
        self.config.set('rules', rules_data)

    def get_default_rules(self):
        return [
            {
                'name': '点歌',
                'triggers': ['点歌', '点一首', '想听'],
                'pattern': r'点(?:歌|一首)\s*(.+?)(?:\s*[-–]\s*(.+))?$',
                'module': 'music_player',
                'params': {},
                'enabled': True
            },
            {
                'name': '查订单',
                'triggers': ['查订单', '订单', '发货了吗'],
                'pattern': r'.*',
                'module': 'query_order',
                'params': {},
                'enabled': True
            },
            {
                'name': '提醒主播',
                'triggers': ['提醒', '记得'],
                'pattern': r'.*',
                'module': 'reminder',
                'params': {},
                'enabled': True
            },
            {
                'name': '问问AI',
                'triggers': ['问问AI', 'AI回答', '问一下'],
                'pattern': r'.*',
                'module': 'forward_st',
                'params': {},
                'enabled': True
            },
        ]

    def clear_screen(self):
        os.system('cls' if os.name == 'nt' else 'clear')

    def draw_panel(self):
        self.clear_screen()

        auto = "ON" if self.auto_reply_enabled else "OFF"
        st_connected = "Yes" if self.st_bridge.check_connection() else "No"

        width = 70
        print("=" * width)
        print(f"|{'DOUYIN SMART BOT v4.0':^{width-30}}|Auto:{auto:<5}|ST:{st_connected:<3}|")
        print("=" * width)
        print(f"| Total: {self.stats['total']:>4}  Joins: {self.stats['joins']:>4}  Actions: {self.stats['actions']:>4} |")
        print(f"| ST Forwarded: {self.stats['forwarded']:>3}  ST Sent: {self.st_bridge.stats['sent']:>3}  Failed: {self.st_bridge.stats['failed']:>3} |")
        print("-" * width)
        print(f"|{'RECENT ACTIONS':^68}|")
        print("-" * width)

        if not self.action_log:
            print(f"|{'[ No actions yet ]':^68}|")
        else:
            for action in list(self.action_log)[-5:]:
                msg = action.get('msg', '')[:45]
                reply = action.get('reply', '')[:25]
                print(f"|\033[33m{msg}\033[0m" + " " * (45 - len(msg)) + f"\033[32m{reply}\033[0m|")

        print("-" * width)
        print(f"|{'RECENT DANMU':^68}|")
        print("-" * width)

        if not self.danmu_list:
            print(f"|{'[ Waiting... ]':^68}|")
        else:
            for danmu in list(self.danmu_list)[-4:]:
                ts = danmu.get('time', '')
                user = danmu.get('user', 'User')[:10]
                content = danmu.get('content', '')[:40]
                actioned = " \033[36m*\033[0m" if danmu.get('actioned') else ""
                print(f"|[{ts}] \033[32m{user}\033[0m: {content}{actioned}" + " " * (68 - len(f"[{ts}] {user}: {content}{actioned}")) + "|")

        print("-" * width)
        print(f"| [1]Connect [2]Disc [3]Cookie [4]Rules [5]Toggle [6]Logs [7]ST [0]Exit |")
        print("=" * width)

    def handle_danmu(self, danmu):
        self.danmu_list.append(danmu)

        if danmu.get('type') == 'join':
            self.stats['joins'] += 1
            return

        self.stats['total'] += 1
        content = danmu.get('content', '')
        user = danmu.get('user', 'User')

        context = {
            'user': user,
            'user_id': danmu.get('user_id', ''),
            'content': content,
            'time': danmu.get('time', '')
        }

        matched_rule = None
        for rule in self.rules:
            if rule.match(content):
                matched_rule = rule
                break

        if matched_rule:
            params = matched_rule.parse(content)
            context['params'] = params
            result = matched_rule.execute(context, self.st_bridge)

            danmu['actioned'] = True

            if result.get('need_forward'):
                if result.get('forward_success'):
                    self.stats['forwarded'] += 1
                    self.action_log.append({
                        'rule': matched_rule.name,
                        'msg': result.get('message', matched_rule.name),
                        'reply': '[转发至SillyTavern]'
                    })
                else:
                    self.action_log.append({
                        'rule': matched_rule.name,
                        'msg': result.get('message', matched_rule.name),
                        'reply': f"[转发失败]"
                    })

            elif result.get('reply'):
                self.stats['actions'] += 1
                self.action_log.append({
                    'rule': matched_rule.name,
                    'msg': result.get('message', matched_rule.name),
                    'reply': result.get('reply', '')
                })

    def connect_room(self):
        room_id = self.config.get('room_id', '')
        cookie = self.config.get('cookie', '')

        if not cookie:
            print("\n[ERROR] Please set Cookie first!")
            input("Press Enter...")
            return

        if not room_id:
            print("\nEnter room URL or ID: ", end="")
            room_id = input().strip()
            if room_id:
                self.config.set('room_id', room_id)

        if not room_id:
            return

        print(f"\nConnecting to {room_id}...")

        success, msg = self.douyin.connect(room_id, cookie)

        if success:
            self.stats = {'total': 0, 'joins': 0, 'actions': 0, 'forwarded': 0}
            self.danmu_list.clear()
            self.action_log.clear()
            self.douyin.on_danmu = self.handle_danmu
            print(f"[OK] {msg}")
        else:
            print(f"[ERROR] {msg}")

        input("Press Enter...")

    def disconnect(self):
        self.douyin.disconnect()
        print("\n[INFO] Disconnected")
        input("Press Enter...")

    def set_cookie(self):
        print("\n" + "=" * 50)
        print("SET COOKIE")
        print("=" * 50)
        print("""
How to get:
1. Open https://live.douyin.com/ and login
2. F12 -> Console
3. Type: copy(document.cookie)
4. Paste below
""")

        cookie = input("Cookie (Enter to clear): ").strip()

        if cookie:
            self.config.set('cookie', cookie)
            print("[OK] Saved")
        else:
            self.config.set('cookie', '')
            print("[INFO] Cleared")

        input("Press Enter...")

    def manage_rules(self):
        while True:
            self.clear_screen()

            print("\n" + "=" * 50)
            print("SMART RULES MANAGER")
            print("=" * 50 + "\n")

            if not self.rules:
                print("[No rules]")
            else:
                for i, rule in enumerate(self.rules, 1):
                    status = "[ON]" if rule.enabled else "[OFF]"
                    triggers = ', '.join(rule.triggers[:2]) if rule.triggers else rule.pattern[:20]
                    module_icon = "🤖" if rule.module == 'forward_st' else "💬"
                    print(f"  {i}. {status} {module_icon} \033[36m{rule.name}\033[0m")
                    print(f"      Trigger: {triggers}")
                    print(f"      Module: {rule.module}")

            print("\n" + "-" * 50)
            print(" [1] Add Rule   [2] Delete   [3] Toggle   [4] Presets   [0] Back")
            print("-" * 50)

            choice = input("\nChoice: ").strip()

            if choice == '1':
                self.add_rule()
            elif choice == '2':
                self.delete_rule()
            elif choice == '3':
                self.toggle_rule()
            elif choice == '4':
                self.load_presets()
            elif choice == '0':
                break

    def add_rule(self):
        print("\nADD RULE")
        name = input("  Rule name: ").strip()
        if not name:
            print("[ERROR] Name required")
            return

        triggers_input = input("  Triggers (comma separated): ").strip()
        triggers = [t.strip() for t in triggers_input.split(',') if t.strip()]

        print("\n  Available modules:")
        print("    1. music_player - 点歌")
        print("    2. query_order - 查询订单")
        print("    3. reminder - 提醒")
        print("    4. custom - 自定义回复")
        print("    5. forward_st - 转发到SillyTavern")

        module_choice = input("  Select module (1-5): ").strip()

        module_map = {
            '1': 'music_player',
            '2': 'query_order',
            '3': 'reminder',
            '4': 'custom',
            '5': 'forward_st'
        }
        module = module_map.get(module_choice, 'custom')

        params = {}

        if module == 'custom':
            reply = input("  Reply text: ").strip()
            if reply:
                params['reply'] = reply

        rule = SmartRule({
            'name': name,
            'triggers': triggers,
            'pattern': '',
            'module': module,
            'params': params,
            'enabled': True
        })

        self.rules.append(rule)
        self.save_rules()
        print(f"\n[OK] Rule '{name}' added")

    def delete_rule(self):
        if not self.rules:
            return
        try:
            idx = int(input("  Number to delete: ").strip()) - 1
            if 0 <= idx < len(self.rules):
                name = self.rules[idx].name
                self.rules.pop(idx)
                self.save_rules()
                print(f"[OK] Deleted '{name}'")
        except ValueError:
            print("[ERROR] Enter a number")

    def toggle_rule(self):
        if not self.rules:
            return
        try:
            idx = int(input("  Number to toggle: ").strip()) - 1
            if 0 <= idx < len(self.rules):
                self.rules[idx].enabled = not self.rules[idx].enabled
                self.save_rules()
                status = "ON" if self.rules[idx].enabled else "OFF"
                print(f"[OK] '{self.rules[idx].name}' is now {status}")
        except ValueError:
            print("[ERROR] Enter a number")

    def load_presets(self):
        presets = [
            {
                'name': '点歌',
                'triggers': ['点歌', '点一首', '想听'],
                'pattern': r'点(?:歌|一首)\s*(.+?)(?:\s*[-–]\s*(.+))?$',
                'module': 'music_player',
                'params': {},
                'enabled': True
            },
            {
                'name': '天气预报',
                'triggers': ['天气', '下雨'],
                'pattern': r'.*',
                'module': 'custom',
                'params': {'reply': '天气信息请关注天气预报哦~'},
                'enabled': True
            },
            {
                'name': '关注主播',
                'triggers': ['关注', '关注一下'],
                'pattern': r'.*',
                'module': 'custom',
                'params': {'reply': '感谢关注！点击头像下方关注按钮哦~'},
                'enabled': True
            },
            {
                'name': '问问AI',
                'triggers': ['问问AI', 'AI回答', '问一下'],
                'pattern': r'.*',
                'module': 'forward_st',
                'params': {},
                'enabled': True
            },
        ]

        print("\nPRESET RULES:")
        for i, p in enumerate(presets, 1):
            triggers = ', '.join(p['triggers']) if p['triggers'] else '无'
            print(f"  {i}. {p['name']} ({triggers})")

        choice = input("\nNumber to add (a=all): ").strip()

        if choice.lower() == 'a':
            indices = range(len(presets))
        else:
            try:
                indices = [int(choice) - 1]
            except ValueError:
                print("[ERROR] Invalid")
                return

        added = 0
        for idx in indices:
            if 0 <= idx < len(presets):
                if not any(r.name == presets[idx]['name'] for r in self.rules):
                    self.rules.append(SmartRule(presets[idx]))
                    added += 1

        self.save_rules()
        print(f"[OK] Added {added} presets")

    def toggle_auto(self):
        self.auto_reply_enabled = not self.auto_reply_enabled
        status = "ON" if self.auto_reply_enabled else "OFF"
        print(f"\n[OK] Auto reply is now {status}")
        input("Press Enter...")

    def show_logs(self):
        self.clear_screen()
        print("\n" + "=" * 60)
        print("ACTION LOGS")
        print("=" * 60 + "\n")

        if not self.action_log:
            print("[No logs]")
        else:
            for action in reversed(list(self.action_log)):
                print(f"[\033[33m{action['rule']}\033[0m]")
                if action.get('msg'):
                    print(f"  -> {action['msg']}")
                print(f"  -> {action['reply']}")
                print()

        input("\nPress Enter...")

    def st_settings(self):
        while True:
            self.clear_screen()
            print("\n" + "=" * 50)
            print("SILLYTAVERN SETTINGS")
            print("=" * 50 + "\n")

            url = self.config.get('sillytavern_url', 'http://localhost:8000')
            connected = "Yes" if self.st_bridge.check_connection() else "No"

            print(f"  URL: {url}")
            print(f"  Connected: {connected}")
            print(f"  Stats: Sent={self.st_bridge.stats['sent']} Failed={self.st_bridge.stats['failed']}")

            print("\n" + "-" * 50)
            print(" [1] Change URL   [2] Test Connection   [0] Back")
            print("-" * 50)

            choice = input("\nChoice: ").strip()

            if choice == '1':
                new_url = input(f"  New URL [{url}]: ").strip()
                if new_url:
                    self.st_bridge.set_url(new_url)
                    print(f"[OK] URL changed to {new_url}")
            elif choice == '2':
                if self.st_bridge.check_connection():
                    print("[OK] Connection successful!")
                else:
                    print("[ERROR] Cannot connect to SillyTavern")
            elif choice == '0':
                break

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
                self.toggle_auto()
            elif choice == '6':
                self.show_logs()
            elif choice == '7':
                self.st_settings()
            elif choice == '0':
                if self.douyin.connected:
                    self.douyin.disconnect()
                print("\n[INFO] Thanks!")
                break

if __name__ == '__main__':
    try:
        panel = RobotPanel()
        panel.run()
    except KeyboardInterrupt:
        print("\n\n[INFO] Exited")
        sys.exit(0)
