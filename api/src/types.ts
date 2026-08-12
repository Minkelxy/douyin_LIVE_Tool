/** 平台弹幕规范化后的统一消息结构，供各平台连接模块和 Socket.IO 广播使用 */
export interface DanmuMessage {
  id: string;
  username: string;
  content: string;
  timestamp: number;
  platform: string;
}
