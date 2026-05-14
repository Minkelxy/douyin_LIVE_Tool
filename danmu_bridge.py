#!/usr/bin/env python3
"""
抖音弹幕 → SillyTavern 桥接器
将抖音直播弹幕转发到SillyTavern，自动触发AI回复+TTS+Live2D
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
        self.config_file = self.config_dir / "bridge_config.json"
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
        self.data.setdefault('sillytavern_url', 'http://localhost:8000')
        self.data.setdefault('auto_tts', True)
        self.data.setdefault('filter_keywords', [])
        self.data.setdefault('blacklist', [])

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
                return False, "空响应，请检查Cookie"
            data = response.json()
            ws_link = data.get('data', {}).get('ws_link')
            if not ws_link:
                return False, "无法获取弹幕链接，请检查Cookie"

            self._start_ws(ws_link)
            return True, "连接成功"

        except Exception as e:
            return False, f"连接失败: {e}"

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
                'user': data.get('user', {}).get('nickname', '用户'),
                'content': data.get('content', ''),
                'time': datetime.now().strftime('%H:%M:%S'),
                'type': 'danmu'
            }
            if self.on_danmu:
                self.on_danmu(danmu)
        elif msg_type == 'member':
            danmu = {
                'id': f"join_{data.get('user', {}).get('id', '')}",
                'user': data.get('user', {}).get('nickname', '访客'),
                'content': '进入了直播间',
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

    def send_message(self, content):
        """发送消息到SillyTavern，触发AI回复"""
        try:
            # 方法1: 通过API发送消息
            # SillyTavern的send_message接口
            url = f"{self.base_url}/api/backends/chat"

            payload = {
                'content': content,
                'name': '弹幕用户',
                'is_system': False
            }

            response = self.session.post(
                url,
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=30
            )

            if response.status_code == 200:
                return True, "消息已发送"

            # 方法2: 尝试其他端点
            return self._try_alternative_endpoints(content)

        except requests.exceptions.ConnectionError:
            return False, "无法连接到SillyTavern，请确保已启动 (默认: http://localhost:8000)"
        except Exception as e:
            return False, f"发送失败: {e}"

    def _try_alternative_endpoints(self, content):
        """尝试其他可能的端点"""
        endpoints = [
            f"{self.base_url}/api/chat",
            f"{self.base_url}/api/generate",
        ]

        for endpoint in endpoints:
            try:
                response = self.session.post(
                    endpoint,
                    json={'prompt': content},
                    timeout=10
                )
                if response.status_code == 200:
                    return True, f"通过 {endpoint} 发送成功"
            except:
                continue

        return False, "所有端点均失败"

    def check_connection(self):
        """检查SillyTavern连接"""
        try:
            response = self.session.get(f"{self.base_url}/api/status", timeout=5)
            return response.status_code == 200
        except:
            return False

class DanmuBridge:
    def __init__(self):
        self.config = Config()
        self.douyin = DouyinDanmu()
        self.st_bridge = SillyTavernBridge(self.config)
        self.danmu_list = deque(maxlen=20)
        self.stats = {'total': 0, 'sent': 0, 'failed': 0}
        self.running = False

    def setup(self):
        """初始设置"""
        print("\n" + "=" * 60)
        print("弹幕 → SillyTavern 桥接器")
        print("=" * 60)

        # 1. 设置Cookie
        cookie = self.config.get('cookie', '')
        if not cookie:
            print("\n[1] 设置Cookie")
            print("-" * 40)
            print("获取方法:")
            print("  1. 打开 https://live.douyin.com/ 并登录")
            print("  2. 按 F12 → Console")
            print("  3. 输入: copy(document.cookie)")
            print("  4. 粘贴到这里")
            print()
            cookie = input("Cookie: ").strip()
            if cookie:
                self.config.set('cookie', cookie)
                print("[OK] Cookie已保存")
            else:
                print("[跳过] 将无法获取弹幕")

        # 2. 设置SillyTavern地址
        print("\n[2] SillyTavern地址")
        st_url = self.config.get('sillytavern_url', 'http://localhost:8000')
        print(f"当前: {st_url}")
        new_url = input("直接回车保持不变，或输入新地址: ").strip()
        if new_url:
            self.config.set('sillytavern_url', new_url)
            self.st_bridge.base_url = new_url.rstrip('/')

        # 3. 检查SillyTavern连接
        print("\n[3] 检查SillyTavern连接...")
        if self.st_bridge.check_connection():
            print("[OK] SillyTavern连接正常")
        else:
            print("[!] 无法连接到SillyTavern")
            print("    请确保SillyTavern已启动: http://localhost:8000")

        # 4. 设置房间号
        room_id = self.config.get('room_id', '')
        if not room_id:
            print("\n[4] 输入抖音直播间链接或房间号")
            room_id = input("房间: ").strip()
            if room_id:
                self.config.set('room_id', room_id)

        print("\n" + "=" * 60)
        input("按回车开始连接...")

    def on_danmu(self, danmu):
        """收到弹幕的处理"""
        self.danmu_list.append(danmu)

        if danmu.get('type') == 'join':
            print(f"[{danmu['time']}] * {danmu['user']} {danmu['content']}")
            return

        self.stats['total'] += 1
        content = danmu['content']
        user = danmu['user']
        ts = danmu['time']

        print(f"[{ts}] {user}: {content}")

        # 过滤黑名单
        if danmu.get('user_id') in self.config.get('blacklist', []):
            print(f"    [跳过] 用户在黑名单中")
            return

        # 构造发送给SillyTavern的消息
        st_message = f"【{user}】{content}"

        # 发送到SillyTavern
        success, msg = self.st_bridge.send_message(st_message)

        if success:
            self.stats['sent'] += 1
            print(f"    [OK] {msg}")
            print(f"    [→] SillyTavern将自动回复+TTS播报")
        else:
            self.stats['failed'] += 1
            print(f"    [失败] {msg}")

    def run(self):
        """运行桥接器"""
        self.setup()

        # 连接抖音
        room_id = self.config.get('room_id', '')
        cookie = self.config.get('cookie', '')

        print(f"\n正在连接直播间 {room_id}...")

        success, msg = self.douyin.connect(room_id, cookie)

        if not success:
            print(f"[错误] {msg}")
            return

        self.running = True
        self.douyin.on_danmu = self.on_danmu

        print(f"\n[OK] {msg}")
        print("\n" + "=" * 60)
        print("桥接器运行中...")
        print(f"弹幕: {self.stats['total']} | 发送: {self.stats['sent']} | 失败: {self.stats['failed']}")
        print("-" * 60)
        print("提示: 弹幕将自动发送到SillyTavern")
        print("      AI回复将自动TTS语音播报")
        print("      按 Ctrl+C 停止")
        print("=" * 60 + "\n")

        try:
            while self.running:
                time.sleep(1)
                # 定期显示状态
                if self.stats['total'] % 10 == 0 and self.stats['total'] > 0:
                    print(f"[状态] 弹幕:{self.stats['total']} 发送:{self.stats['sent']} 失败:{self.stats['failed']}")
        except KeyboardInterrupt:
            self.stop()

    def stop(self):
        self.running = False
        self.douyin.disconnect()
        print("\n" + "=" * 60)
        print("桥接器已停止")
        print(f"总计: {self.stats['total']}条弹幕, {self.stats['sent']}条已发送")
        print("=" * 60)

if __name__ == '__main__':
    try:
        bridge = DanmuBridge()
        bridge.run()
    except KeyboardInterrupt:
        print("\n\n程序已退出")
        sys.exit(0)
