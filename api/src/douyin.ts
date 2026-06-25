import { WebSocket } from 'ws';

export interface DanmuMessage {
  id: string;
  username: string;
  content: string;
  timestamp: number;
  platform: string;
}

// Go 代理服务默认地址
const PROXY_URL = process.env.DOUYIN_PROXY_URL || 'ws://127.0.0.1:1088';

export class DouyinLive {
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

  async connect() {
    if (this.connected) return;

    const url = `${PROXY_URL}/ws/${this.roomId}`;
    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      this.connected = true;
      this.onStatusChange?.(true);
    });

    this.ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());

        // 系统消息
        if (msg.type === 'system') {
          const live = msg.event === 'live_status' && msg.live === true;
          if (live) this.onStatusChange?.(true);
          return;
        }

        // 弹幕消息
        if (msg.method === 'WebcastChatMessage') {
          this.onMessage?.({
            id: msg.common?.msgId || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            username: msg.user?.nickname || '匿名',
            content: msg.content || '',
            timestamp: Date.now(),
            platform: 'douyin',
          });
        }
        // 礼物
        else if (msg.method === 'WebcastGiftMessage') {
          this.onMessage?.({
            id: msg.common?.msgId || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            username: msg.user?.nickname || '匿名',
            content: `[礼物] ${msg.gift?.name || '未知礼物'} x${msg.totalCount || 1}`,
            timestamp: Date.now(),
            platform: 'douyin',
          });
        }
        // 点赞
        else if (msg.method === 'WebcastLikeMessage') {
          this.onMessage?.({
            id: msg.common?.msgId || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            username: msg.user?.nickname || '匿名',
            content: `[点赞] x${msg.count || 1}`,
            timestamp: Date.now(),
            platform: 'douyin',
          });
        }
        // 进场
        else if (msg.method === 'WebcastMemberMessage') {
          this.onMessage?.({
            id: msg.common?.msgId || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            username: msg.user?.nickname || '匿名',
            content: '[进入直播间]',
            timestamp: Date.now(),
            platform: 'douyin',
          });
        }
        // 关注
        else if (msg.method === 'WebcastSocialMessage') {
          this.onMessage?.({
            id: msg.common?.msgId || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            username: msg.user?.nickname || '匿名',
            content: '[关注了主播]',
            timestamp: Date.now(),
            platform: 'douyin',
          });
        }
      } catch {
        // 非 JSON 消息忽略
      }
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

  isConnected() {
    return this.connected;
  }
}
