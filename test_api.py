#!/usr/bin/env python3
import requests
import json
import re
import sys

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
}

def get_room_info(room_id):
    """获取直播间信息"""
    print(f"\n方法1: 获取直播间信息...")
    try:
        response = requests.get(
            f'https://live.douyin.com/webcast/live/web/room/info/?room_id={room_id}',
            headers=headers,
            timeout=10
        )
        print(f"状态码: {response.status_code}")
        print(f"响应长度: {len(response.text)}")

        if response.text:
            try:
                data = response.json()
                print(f"响应: {json.dumps(data, indent=2, ensure_ascii=False)[:1000]}")
            except:
                print(f"响应内容: {response.text[:500]}")
        return response
    except Exception as e:
        print(f"错误: {e}")
        return None

def try_fetch_im(room_id):
    """尝试IM接口"""
    print(f"\n方法2: IM弹幕接口...")

    params = {
        'room_id': room_id,
        'user_id': '',
        'type': '0',
        'internal_ext': '',
        'live_timing': '1',
    }

    try:
        response = requests.get(
            'https://live.douyin.com/webcast/im/fetch/',
            params=params,
            headers=headers,
            timeout=10
        )
        print(f"状态码: {response.status_code}")
        print(f"响应: {response.text[:500] if response.text else '空响应'}")
        return response
    except Exception as e:
        print(f"错误: {e}")
        return None

def try_webcast_api(room_id):
    """尝试Webcast API"""
    print(f"\n方法3: Webcast API...")

    try:
        response = requests.get(
            f'https://webcast2.douyincdn.com/api/v2/chatroom/{room_id}/fetch/',
            headers=headers,
            timeout=10
        )
        print(f"状态码: {response.status_code}")
        print(f"响应: {response.text[:500] if response.text else '空响应'}")
        return response
    except Exception as e:
        print(f"错误: {e}")
        return None

def try_room_info_api(room_id):
    """尝试直播间信息API"""
    print(f"\n方法4: 直播间信息API...")

    try:
        response = requests.get(
            f'https://api.tiktokv.com/aweme/v1/room/info/?room_id={room_id}',
            headers=headers,
            timeout=10
        )
        print(f"状态码: {response.status_code}")
        if response.text:
            try:
                data = response.json()
                print(f"响应: {json.dumps(data, indent=2, ensure_ascii=False)[:1000]}")
            except:
                print(f"响应内容: {response.text[:500]}")
        return response
    except Exception as e:
        print(f"错误: {e}")
        return None

if __name__ == '__main__':
    room_id = sys.argv[1] if len(sys.argv) > 1 else input("输入房间号: ").strip()

    if not room_id or len(room_id) < 15:
        print("房间号格式不正确")
        sys.exit(1)

    print(f"测试房间号: {room_id}")
    print("="*60)

    # 尝试多个接口
    get_room_info(room_id)
    try_fetch_im(room_id)
    try_webcast_api(room_id)
    try_room_info_api(room_id)

    print("\n" + "="*60)
    print("测试完成")
