import type { Danmu } from '../types/danmu';

const usernames = [
  '阳光少年', '深夜食堂', '追星少女', '游戏达人', '技术宅',
  '音乐王子', '舞蹈精灵', '美食探索', '旅行家小李', '书虫小白',
  '动漫迷', '电竞选手', '户外爱好者', '摄影达人', '潮流教主'
];

const messages = [
  '主播好厉害！',
  '666666',
  '这波操作秀翻了',
  '学到了学到了',
  '哈哈哈哈哈',
  '前方高能预警',
  '弹幕大军来袭',
  '支持支持！',
  '太牛了',
  '这是什么神仙操作',
  '来了来了',
  '蹲一个后续',
  '绝了绝了',
  '打call打call',
  '稳住了',
  '冲冲冲',
  '来了老弟',
  '扎心了老铁',
  '奥利给',
  '给跪了'
];

const colors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
];

let idCounter = 0;

export function generateRandomDanmu(): Danmu {
  const username = usernames[Math.floor(Math.random() * usernames.length)];
  const content = messages[Math.floor(Math.random() * messages.length)];
  const color = colors[Math.floor(Math.random() * colors.length)];

  return {
    id: `danmu-${++idCounter}-${Date.now()}`,
    username,
    content,
    timestamp: Date.now(),
    color
  };
}

export function generateReplyDanmu(content: string): Danmu {
  return {
    id: `reply-${Date.now()}`,
    username: '我',
    content,
    timestamp: Date.now(),
    color: '#8B5CF6',
    isReply: true
  };
}
