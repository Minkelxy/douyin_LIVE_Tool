import { WebSocket } from 'ws';
import type { DanmuMessage } from './douyin';

export interface LiveConnection {
  roomId: string;
  platform: 'bilibili' | 'douyin';
  ws?: WebSocket;
  connected: boolean;
  onMessage?: (msg: DanmuMessage) => void;
  onStatusChange?: (connected: boolean) => void;
}

const MAX_RECONNECT_DELAY = 30000;
const INITIAL_RECONNECT_DELAY = 1000;

export class BilibiliLive {
  private roomId: string;
  private ws?: WebSocket;
  private connected = false;
  private onMessage?: (msg: DanmuMessage) => void;
  private onStatusChange?: (connected: boolean) => void;
  private reconnectAttempts = 0;
  private reconnectTimeout?: ReturnType<typeof setTimeout>;
  private intentionalClose = false;

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

  connect() {
    if (this.connected) return;
    this.intentionalClose = false;

    const url = `wss://broadcastlv.chat.bilibili.com:2245/sub`;

    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      this.onStatusChange?.(true);
      this.sendJoinPacket();
    });

    this.ws.on('message', (data: Buffer) => {
      this.handleMessage(data);
    });

    this.ws.on('close', () => {
      this.connected = false;
      this.onStatusChange?.(false);
      this.scheduleReconnect();
    });

    this.ws.on('error', () => {
      this.connected = false;
      this.onStatusChange?.(false);
    });
  }

  disconnect() {
    this.intentionalClose = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }
    this.ws?.close();
    this.connected = false;
    this.reconnectAttempts = 0;
    this.onStatusChange?.(false);
  }

  private scheduleReconnect() {
    if (this.intentionalClose || this.reconnectTimeout) return;

    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts),
      MAX_RECONNECT_DELAY
    );
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = undefined;
      this.connect();
    }, delay);
  }

  private sendJoinPacket() {
    if (!this.ws) return;

    const packet = {
      uid: 0,
      roomid: parseInt(this.roomId),
      protover: 2,
      platform: 'web',
      clientver: '1.4.0',
      type: 2
    };

    const buffer = Buffer.alloc(16 + JSON.stringify(packet).length);
    buffer.writeUInt32BE(buffer.length - 4, 0);
    buffer.writeUInt16BE(16, 4);
    buffer.writeUInt16BE(1, 6);
    buffer.writeUInt32BE(7, 8);
    buffer.writeUInt32BE(1, 12);
    buffer.write(JSON.stringify(packet), 16);
    
    this.ws.send(buffer);
  }

  private handleMessage(data: Buffer) {
    if (data.length < 16) return;

    const headerLen = data.readUInt16BE(4);
    const op = data.readUInt32BE(8);

    if (op === 2) {
      // 心跳请求，回应心跳
      this.sendHeartbeatReply();
    } else if (op === 5) {
      const body = data.slice(headerLen);
      this.handleNotifications(body);
    }
  }

  private sendHeartbeatReply() {
    if (!this.ws || !this.connected) return;
    const buffer = Buffer.alloc(16);
    buffer.writeUInt32BE(16, 0);
    buffer.writeUInt16BE(16, 4);
    buffer.writeUInt16BE(1, 6);
    buffer.writeUInt32BE(3, 8);
    buffer.writeUInt32BE(1, 12);
    this.ws.send(buffer);
  }

  private handleNotifications(body: Buffer) {
    try {
      const jsonStr = body.toString('utf-8');
      const data = JSON.parse(jsonStr);

      if (!Array.isArray(data)) return;

      for (const item of data) {
        const msg: DanmuMessage = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          username: '',
          content: '',
          timestamp: Date.now(),
          platform: 'bilibili'
        };

        if (item.cmd === 'DANMU_MSG') {
          const info = item.info;
          if (info && info[1] && info[2]) {
            msg.username = info[2][1];
            msg.content = info[1];
            this.onMessage?.(msg);
          }
        } else if (item.cmd === 'SEND_GIFT') {
          const d = item.data;
          if (d) {
            msg.username = d.uname || '匿名';
            msg.content = `[礼物] ${d.giftName || '礼物'} x${d.num || 1}`;
            this.onMessage?.(msg);
          }
        } else if (item.cmd === 'INTERACT_WORD') {
          const d = item.data;
          if (d) {
            msg.username = d.uname || '匿名';
            msg.content = d.msg_type === 2 ? '[关注了主播]' : '[进入直播间]';
            this.onMessage?.(msg);
          }
        } else if (item.cmd === 'WELCOME') {
          const d = item.data;
          if (d) {
            msg.username = d.uname || '匿名';
            msg.content = '[进入直播间]';
            this.onMessage?.(msg);
          }
        } else if (item.cmd === 'GUARD_BUY') {
          const d = item.data;
          if (d) {
            msg.username = d.username || '匿名';
            msg.content = `[开通舰长] ${d.gift_name || ''}`;
            this.onMessage?.(msg);
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
