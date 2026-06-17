import { WebSocket } from 'ws';
import axios from 'axios';
import { loadSync, Root } from 'protobufjs';
import * as fs from 'fs';
import * as path from 'path';

export interface DanmuMessage {
  id: string;
  username: string;
  content: string;
  timestamp: number;
  platform: string;
}

const DOUBAN_PB_PATH = path.join(__dirname, '../proto/douyin.proto');

let protoRoot: Root | null = null;

try {
  if (fs.existsSync(DOUBAN_PB_PATH)) {
    protoRoot = loadSync(DOUBAN_PB_PATH);
  }
} catch {
  console.log('Protobuf definition not found, using JSON fallback');
}

export class DouyinLive {
  private roomId: string;
  private ws?: WebSocket;
  private connected = false;
  private onMessage?: (msg: DanmuMessage) => void;
  private onStatusChange?: (connected: boolean) => void;
  private heartbeatInterval?: NodeJS.Timer;

  constructor(roomId: string) {
    this.roomId = roomId;
  }

  setCallbacks(
    onMessage: (msg: DanmuMessage) => void,
    onStatusChange: (connected: boolean) => void
  ) {
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
  }

  async connect() {
    if (this.connected) return;

    try {
      const info = await this.getRoomInfo();
      if (!info) {
        this.onStatusChange?.(false);
        return;
      }

      const url = await this.buildWsUrl(info);
      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        this.connected = true;
        this.onStatusChange?.(true);
        this.startHeartbeat();
      });

      this.ws.on('message', (data: Buffer) => {
        this.handleMessage(data);
      });

      this.ws.on('close', () => {
        this.connected = false;
        this.stopHeartbeat();
        this.onStatusChange?.(false);
      });

      this.ws.on('error', () => {
        this.connected = false;
        this.stopHeartbeat();
        this.onStatusChange?.(false);
      });
    } catch {
      this.onStatusChange?.(false);
    }
  }

  disconnect() {
    this.stopHeartbeat();
    this.ws?.close();
    this.connected = false;
    this.onStatusChange?.(false);
  }

  private async getRoomInfo(): Promise<{ roomId: string; webcastId?: string } | null> {
    try {
      const response = await axios.get(`https://www.douyin.com/live/${this.roomId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const html = response.data;
      const match = html.match(/"roomId":(\d+)/);
      if (match) {
        return { roomId: match[1] };
      }
    } catch {
      console.log('Failed to get room info, using provided roomId');
    }
    return { roomId: this.roomId };
  }

  private async buildWsUrl(info: { roomId: string }): Promise<string> {
    const baseUrl = 'wss://webcast100-ws-web-lq.douyin.com/webcast/im/push/v2/';
    const params = new URLSearchParams({
      app_name: 'douyin_web',
      version_code: '180800',
      webcast_sdk_version: '1.0.14-beta.0',
      room_id: info.roomId,
      user_unique_id: `${Date.now()}${Math.random().toString(36).slice(2, 15)}`,
      signature: this.generateSignature()
    });
    return `${baseUrl}?${params.toString()}`;
  }

  private generateSignature(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let signature = '';
    for (let i = 0; i < 32; i++) {
      signature += chars[Math.floor(Math.random() * chars.length)];
    }
    return signature;
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.connected) {
        const heartbeat = JSON.stringify({
          type: 'hb'
        });
        this.ws.send(heartbeat);
      }
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  private handleMessage(data: Buffer) {
    try {
      const msg = this.parseMessage(data);
      if (msg) {
        this.onMessage?.(msg);
      }
    } catch {
      this.tryParseSimple(data);
    }
  }

  private parseMessage(data: Buffer): DanmuMessage | null {
    if (!protoRoot) return null;

    try {
      const Message = protoRoot.lookupType('Message');
      const decoded = Message.decode(data.slice(16));
      
      if (decoded.method === 'WebcastChatMessage') {
        const payload = JSON.parse(decoded.payload);
        const user = payload.user || {};
        
        return {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          username: user.nickname || '匿名',
          content: payload.content || '',
          timestamp: Date.now(),
          platform: 'douyin'
        };
      }
    } catch {
      // Protobuf解析失败，尝试其他方式
    }
    return null;
  }

  private tryParseSimple(data: Buffer) {
    try {
      const str = data.toString('utf-8');
      const parsed = JSON.parse(str);
      
      if (parsed.messages) {
        for (const msg of parsed.messages) {
          if (msg.method === 'WebcastChatMessage') {
            const payload = JSON.parse(msg.payload || '{}');
            const user = payload.user || {};
            
            this.onMessage?.({
              id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
              username: user.nickname || '匿名',
              content: payload.content || '',
              timestamp: Date.now(),
              platform: 'douyin'
            });
          }
        }
      }
    } catch {
      // 解析失败忽略
    }
  }

  isConnected() {
    return this.connected;
  }
}
