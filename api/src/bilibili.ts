import { WebSocket } from 'ws';
import type { DanmuMessage } from './types';
import { parseBilibiliEvent } from './bilibiliParse';

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

    this.ws.on('error', (err) => {
      console.error('Bilibili WebSocket error:', err);
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

    const roomIdNum = parseInt(this.roomId, 10);
    if (isNaN(roomIdNum)) {
      console.error(`Invalid bilibili roomId: ${this.roomId}`);
      return;
    }

    const packet = {
      uid: 0,
      roomid: roomIdNum,
      protover: 2,
      platform: 'web',
      clientver: '1.4.0',
      type: 2
    };

    const buffer = Buffer.alloc(16 + JSON.stringify(packet).length);
    buffer.writeUInt32BE(buffer.length, 0);
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
        const msg = parseBilibiliEvent(item);
        if (msg) {
          this.onMessage?.(msg);
        }
      }
    } catch (err) {
      console.error('Bilibili message parse error:', err);
    }
  }

  isConnected() {
    return this.connected;
  }
}
