import { WebSocket } from 'ws';

export interface DanmuMessage {
  id: string;
  username: string;
  content: string;
  timestamp: number;
  platform: string;
}

export interface LiveConnection {
  roomId: string;
  platform: 'bilibili' | 'douyin';
  ws?: WebSocket;
  connected: boolean;
  onMessage?: (msg: DanmuMessage) => void;
  onStatusChange?: (connected: boolean) => void;
}

export class BilibiliLive {
  private roomId: string;
  private ws?: WebSocket;
  private connected = false;
  private onMessage?: (msg: DanmuMessage) => void;
  private onStatusChange?: (connected: boolean) => void;

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

    const url = `wss://broadcastlv.chat.bilibili.com:2245/sub`;
    
    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      this.connected = true;
      this.onStatusChange?.(true);
      this.sendJoinPacket();
    });

    this.ws.on('message', (data: Buffer) => {
      this.handleMessage(data);
    });

    this.ws.on('close', () => {
      this.connected = false;
      this.onStatusChange?.(false);
    });

    this.ws.on('error', () => {
      this.connected = false;
      this.onStatusChange?.(false);
    });
  }

  disconnect() {
    this.ws?.close();
    this.connected = false;
    this.onStatusChange?.(false);
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

    if (op === 5) {
      const body = data.slice(headerLen);
      this.parseDanmu(body);
    } else if (op === 3) {
      // 人气值更新，忽略
    }
  }

  private parseDanmu(body: Buffer) {
    try {
      const jsonStr = body.toString('utf-8');
      const data = JSON.parse(jsonStr);
      
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item.cmd === 'DANMU_MSG') {
            const info = item.info;
            if (info && info[1] && info[2]) {
              const msg: DanmuMessage = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                username: info[2][1],
                content: info[1],
                timestamp: Date.now(),
                platform: 'bilibili'
              };
              this.onMessage?.(msg);
            }
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
