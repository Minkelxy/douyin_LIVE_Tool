import { WebSocket } from 'ws';
import axios from 'axios';

export interface DanmuMessage {
  id: string;
  username: string;
  content: string;
  timestamp: number;
  platform: string;
}

export class DouyinLive {
  private roomId: string;
  private ws?: WebSocket;
  private connected = false;
  private onMessage?: (msg: DanmuMessage) => void;
  private onStatusChange?: (connected: boolean) => void;
  private heartbeatInterval?: ReturnType<typeof setInterval>;

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
      const url = await this.buildWsUrl();
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

  private async buildWsUrl(): Promise<string> {
    const baseUrl = 'wss://webcast3-ws-web-lf.bytedance.com/webcast/im/push/v2/';
    const params = new URLSearchParams({
      app_name: 'douyin_web',
      version_code: '180800',
      webcast_sdk_version: '1.0.14-beta.0',
      room_id: this.roomId,
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
        const heartbeat = JSON.stringify({ type: 'hb' });
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
      const str = data.toString('utf-8');
      const parsed = JSON.parse(str);

      if (parsed.messages) {
        for (const msg of parsed.messages) {
          if (msg.method === 'WebcastChatMessage') {
            const payload = JSON.parse(msg.payload || '{}');
            const user = payload.user || {};
            
            this.onMessage?.({
              id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
              username: user.nickname || user.nickName || '匿名',
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
