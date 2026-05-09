#!/usr/bin/env python3
import requests
import json
import re
import sys

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Referer': 'https://live.douyin.com/',
}

def extract_room_id(input_str):
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

def test_connection(room_id):
    print(f"\n测试连接抖音直播间...")
    print(f"房间号: {room_id}")
    print("-" * 50)

    try:
        params = {
            'room_id': room_id,
            'user_id': '',
            'type': '0',
            'internal_ext': '',
            'live_timing': '1',
        }

        print("正在请求弹幕接口...")
        response = requests.get(
            'https://live.douyin.com/webcast/im/fetch/',
            params=params,
            headers=headers,
            timeout=10
        )

        print(f"HTTP状态码: {response.status_code}")
        print(f"响应内容长度: {len(response.text)} 字节")

        if response.status_code == 200:
            data = response.json()
            print(f"\n响应JSON: {json.dumps(data, indent=2, ensure_ascii=False)[:500]}")

            ws_link = data.get('data', {}).get('ws_link')
            ws_param = data.get('data', {}).get('ws_param')

            if ws_link:
                print(f"\n✅ 获取WebSocket链接成功!")
                print(f"ws_link: {ws_link[:100]}...")
                return True
            else:
                print(f"\n❌ 未获取到WebSocket链接")
                print(f"data字段: {data.get('data', {})}")
                return False
        else:
            print(f"\n❌ HTTP请求失败")
            return False

    except requests.exceptions.Timeout:
        print("❌ 请求超时")
        return False
    except requests.exceptions.RequestException as e:
        print(f"❌ 请求异常: {e}")
        return False
    except Exception as e:
        print(f"❌ 未知错误: {e}")
        return False

if __name__ == '__main__':
    if len(sys.argv) > 1:
        room_id = sys.argv[1]
    else:
        room_id = input("请输入直播间链接或房间号: ").strip()

    room_id = extract_room_id(room_id)

    if not room_id:
        print("❌ 无效的房间号")
        sys.exit(1)

    success = test_connection(room_id)
    sys.exit(0 if success else 1)
