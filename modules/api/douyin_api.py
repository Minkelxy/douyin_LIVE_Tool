import requests
import re
import json
import time
import threading
import websocket
from typing import Optional, Callable, Dict, List
from datetime import datetime

class DouyinAPI:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Referer': 'https://live.douyin.com/',
        }
        self.room_id = None
        self.web_socket = None
        self.is_connected = False
        self.is_running = False
        self.on_danmu_callback = None
        self.on_status_callback = None
        self.reconnect_attempts = 0
        self.max_reconnect = 5
        self.reply_queue = []
        self.reply_thread = None
        self.reply_interval = 3

    def set_room_id(self, room_id: str) -> bool:
        room_id = room_id.strip()

        if 'live.douyin.com' in room_id:
            match = re.search(r'/(\d+)', room_id)
            if match:
                room_id = match.group(1)
            else:
                match = re.search(r'(\d{19,})', room_id)
                if match:
                    room_id = match.group(1)

        if not room_id.isdigit():
            return False

        self.room_id = room_id
        return True

    def get_live_room_info(self, room_id: str) -> Optional[Dict]:
        url = f"https://live.douyin.com/webcast/live/web/room/info/?"

        try:
            response = requests.get(
                url,
                params={'room_id': room_id},
                headers=self.headers,
                timeout=10
            )

            if response.status_code == 200:
                data = response.json()
                if data.get('status_code') == 0:
                    room_data = data.get('data', {})
                    return {
                        'room_id': room_data.get('room_id'),
                        'nickname': room_data.get('nickname', '未知主播'),
                        'title': room_data.get('title', '直播间'),
                        'status': room_data.get('status'),
                        'viewer_count': room_data.get('user_count', 0)
                    }
        except Exception as e:
            print(f"获取直播间信息失败: {e}")

        return None

    def connect(self, room_id: str = None) -> bool:
        if room_id:
            if not self.set_room_id(room_id):
                self.update_status("无效的直播间ID", False)
                return False

        if not self.room_id:
            self.update_status("请先输入直播间ID", False)
            return False

        self.update_status("正在连接直播间...", True)

        try:
            params = {
                'room_id': self.room_id,
                'user_id': '',
                'type': '0',
                'internal_ext': '',
                'live_timing': '1',
            }

            response = requests.get(
                'https://live.douyin.com/webcast/im/fetch/',
                params=params,
                headers=self.headers,
                timeout=10
            )

            if response.status_code != 200:
                self.update_status("连接失败: HTTP " + str(response.status_code), False)
                return False

            data = response.json()
            ws_data = data.get('data', {})
            ws_link = ws_data.get('ws_link')
            ws_param = ws_data.get('ws_param')

            if not ws_link:
                self.update_status("获取WebSocket链接失败", False)
                return False

            self.start_websocket(ws_link, ws_param)
            return True

        except requests.RequestException as e:
            self.update_status(f"连接失败: {str(e)}", False)
            return False

    def start_websocket(self, ws_link: str, ws_param: Dict):
        def on_open(ws):
            self.is_connected = True
            self.is_running = True
            self.reconnect_attempts = 0
            self.update_status("已连接到直播间", True)
            self.start_heartbeat(ws)
            self.start_reply_worker(ws)

        def on_message(ws, message):
            try:
                msg_data = json.loads(message)
                self.handle_message(msg_data)
            except json.JSONDecodeError:
                pass

        def on_error(ws, error):
            print(f"WebSocket错误: {error}")
            self.update_status(f"连接错误: {str(error)}", False)

        def on_close(ws, close_status_code, close_msg):
            self.is_connected = False
            self.is_running = False
            self.update_status("连接已关闭", False)
            self.handle_reconnect()

        self.web_socket = websocket.WebSocketApp(
            ws_link,
            header=self.get_websocket_headers(),
            on_open=on_open,
            on_message=on_message,
            on_error=on_error,
            on_close=on_close
        )

        ws_thread = threading.Thread(target=self.web_socket.run_forever, daemon=True)
        ws_thread.start()

    def get_websocket_headers(self) -> List[str]:
        return [
            "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept: */*",
            "Accept-Encoding: gzip, deflate, br",
            "Accept-Language: zh-CN,zh;q=0.9",
        ]

    def start_heartbeat(self, ws):
        def heartbeat():
            while self.is_running and self.is_connected:
                try:
                    heartbeat_msg = json.dumps({
                        'type': 'heartbeat',
                        'data': {
                            'room_id': self.room_id,
                            'timestamp': int(time.time() * 1000)
                        }
                    })
                    ws.send(heartbeat_msg)
                    time.sleep(20)
                except Exception as e:
                    print(f"心跳包发送失败: {e}")
                    break

        thread = threading.Thread(target=heartbeat, daemon=True)
        thread.start()

    def handle_message(self, msg_data: Dict):
        msg_type = msg_data.get('type', '')

        if msg_type == 'chat':
            danmu_info = {
                'id': str(msg_data.get('msg_id', '')),
                'user_id': str(msg_data.get('user', {}).get('id', '')),
                'nickname': msg_data.get('user', {}).get('nickname', '匿名用户'),
                'content': msg_data.get('content', ''),
                'timestamp': msg_data.get('created_at', ''),
                'fan_level': msg_data.get('user', {}).get('fans_level', 0),
                'received_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'replied': False
            }

            if self.on_danmu_callback:
                self.on_danmu_callback(danmu_info)

        elif msg_type == 'member':
            join_info = {
                'id': f"join_{msg_data.get('user', {}).get('id', '')}_{msg_data.get('created_at', '')}",
                'user_id': str(msg_data.get('user', {}).get('id', '')),
                'nickname': msg_data.get('user', {}).get('nickname', '访客'),
                'content': '进入了直播间',
                'timestamp': msg_data.get('created_at', ''),
                'fan_level': 0,
                'received_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'replied': False,
                'is_join': True
            }

            if self.on_danmu_callback:
                self.on_danmu_callback(join_info)

    def handle_reconnect(self):
        if self.reconnect_attempts < self.max_reconnect and self.is_running:
            self.reconnect_attempts += 1
            self.update_status(f"正在尝试重连 ({self.reconnect_attempts}/{self.max_reconnect})...", True)
            time.sleep(5)
            if self.room_id:
                self.connect(self.room_id)
        elif self.reconnect_attempts >= self.max_reconnect:
            self.update_status("重连次数已达上限，请手动重连", False)

    def disconnect(self):
        self.is_running = False
        self.is_connected = False
        if self.web_socket:
            self.web_socket.close()
        self.update_status("已断开连接", False)

    def send_reply(self, content: str) -> bool:
        if not self.is_connected:
            return False

        self.reply_queue.append(content)
        return True

    def start_reply_worker(self, ws):
        def worker():
            while self.is_running:
                try:
                    if self.reply_queue:
                        content = self.reply_queue.pop(0)
                        reply_msg = json.dumps({
                            'type': 'chat',
                            'data': {
                                'content': content,
                                'room_id': self.room_id
                            }
                        })
                        ws.send(reply_msg)
                        time.sleep(self.reply_interval)
                    else:
                        time.sleep(0.5)
                except Exception as e:
                    print(f"发送回复失败: {e}")

        self.reply_thread = threading.Thread(target=worker, daemon=True)
        self.reply_thread.start()

    def set_reply_interval(self, seconds: int):
        self.reply_interval = max(1, seconds)

    def set_on_danmu_callback(self, callback: Callable):
        self.on_danmu_callback = callback

    def set_on_status_callback(self, callback: Callable):
        self.on_status_callback = callback

    def update_status(self, message: str, is_connected: bool = None):
        if is_connected is not None:
            self.is_connected = is_connected
        if self.on_status_callback:
            self.on_status_callback(message, is_connected if is_connected is not None else self.is_connected)

    def get_room_id_from_url(self, url: str) -> Optional[str]:
        try:
            response = requests.get(url, headers=self.headers, timeout=10, allow_redirects=True)
            final_url = response.url

            room_id_match = re.search(r'/(\d{19,})', final_url)
            if room_id_match:
                return room_id_match.group(1)

            room_id_match = re.search(r'room_id=(\d+)', final_url)
            if room_id_match:
                return room_id_match.group(1)

            room_id_match = re.search(r'(\d{19,})', final_url)
            if room_id_match:
                return room_id_match.group(1)

        except Exception as e:
            print(f"解析直播间链接失败: {e}")

        return None
