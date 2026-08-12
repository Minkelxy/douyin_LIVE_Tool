/** 平台弹幕规范化后的统一消息结构，供各平台连接模块和 Socket.IO 广播使用 */
export interface DanmuMessage {
  id: string;
  username: string;
  content: string;
  timestamp: number;
  platform: string;
}

/** 客户端 → 服务端 事件 */
export interface DanmuClientEvents {
  join: (data: { platform: 'bilibili' | 'douyin'; roomId: string }) => void;
}

/** 服务端 → 客户端 事件 */
export interface DanmuServerEvents {
  danmu: (msg: DanmuMessage) => void;
  status: (status: { platform: string; roomId: string; connected: boolean }) => void;
}
