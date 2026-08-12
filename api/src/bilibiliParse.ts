import type { DanmuMessage } from './types';

/**
 * 把一条 B站通知（JSON.parse 后的数组项）映射为规范化弹幕。
 * 无法识别的 cmd / 结构不完整返回 null。纯函数，可独立单测。
 */
export function parseBilibiliEvent(item: unknown): DanmuMessage | null {
  if (!item || typeof item !== 'object') return null;
  const rec = item as Record<string, unknown>;
  const cmd = rec.cmd;
  const msgId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  if (cmd === 'DANMU_MSG') {
    const info = rec.info;
    if (Array.isArray(info) && info[1] && info[2]) {
      return {
        id: msgId,
        username: (info[2] as unknown[])[1] as string,
        content: info[1] as string,
        timestamp: Date.now(),
        platform: 'bilibili',
      };
    }
  } else if (cmd === 'SEND_GIFT') {
    const data = asRecord(rec.data);
    if (data) {
      return {
        id: msgId,
        username: (data.uname as string) || '匿名',
        content: `[礼物] ${(data.giftName as string) || '礼物'} x${data.num || 1}`,
        timestamp: Date.now(),
        platform: 'bilibili',
      };
    }
  } else if (cmd === 'INTERACT_WORD') {
    const data = asRecord(rec.data);
    if (data) {
      return {
        id: msgId,
        username: (data.uname as string) || '匿名',
        content: data.msg_type === 2 ? '[关注了主播]' : '[进入直播间]',
        timestamp: Date.now(),
        platform: 'bilibili',
      };
    }
  } else if (cmd === 'WELCOME') {
    const data = asRecord(rec.data);
    if (data) {
      return {
        id: msgId,
        username: (data.uname as string) || '匿名',
        content: '[进入直播间]',
        timestamp: Date.now(),
        platform: 'bilibili',
      };
    }
  } else if (cmd === 'GUARD_BUY') {
    const data = asRecord(rec.data);
    if (data) {
      return {
        id: msgId,
        username: (data.username as string) || '匿名',
        content: `[开通舰长] ${(data.gift_name as string) || ''}`,
        timestamp: Date.now(),
        platform: 'bilibili',
      };
    }
  }

  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}
