import type { Danmu } from '../types/danmu';
import type {
  AutoReplyRule,
  GiftReplyRule,
  LotteryParticipant,
  VoteOption,
  VoteSession
} from '../types/interaction';

/**
 * 弹幕互动核心匹配逻辑（纯函数，可独立测试）。
 * useInteraction hook 只负责状态管理，具体判定都走这里。
 */

/** 礼物弹幕格式：[礼物] 礼物名 x数量 */
export const GIFT_PATTERN = /^\[礼物\] (.+?) x(\d+)$/;

/**
 * 自动回复：按规则顺序做关键词匹配，返回第一条命中的回复；无命中返回 null。
 * matchMode 为 exact 时要求弹幕内容与关键词完全一致，否则为包含匹配。
 * 空关键词规则直接跳过，避免对每条弹幕都触发。
 */
export function matchAutoReply(danmu: Danmu, rules: AutoReplyRule[]): string | null {
  const text = danmu.content.toLowerCase();
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const kw = rule.keyword.trim().toLowerCase();
    if (!kw) continue;
    const hit = rule.matchMode === 'exact' ? text === kw : text.includes(kw);
    if (hit) return rule.reply;
  }
  return null;
}

/**
 * 礼物感谢：解析 "[礼物] 名字 x数量"，按礼物名包含匹配，用模板生成回复；
 * 非礼物弹幕或未命中规则返回 null。
 */
export function matchGiftReply(danmu: Danmu, rules: GiftReplyRule[]): string | null {
  const match = danmu.content.match(GIFT_PATTERN);
  if (!match) return null;
  const giftName = match[1];
  const giftCount = parseInt(match[2], 10);

  for (const rule of rules) {
    if (!rule.enabled) continue;
    const name = rule.giftName.trim().toLowerCase();
    if (name && giftName.toLowerCase().includes(name)) {
      return rule.replyTemplate
        .replace('{user}', danmu.username)
        .replace('{gift}', `${giftName} x${giftCount}`);
    }
  }
  return null;
}

/**
 * 抽奖参与判定：弹幕包含关键词，且该用户尚未参与。
 * keyword 为空时不判定（抽奖未开启）。
 */
export function canJoinLottery(
  danmu: Danmu,
  keyword: string,
  participants: LotteryParticipant[]
): boolean {
  if (!keyword) return false;
  if (participants.some(p => p.username === danmu.username)) return false;
  return danmu.content.toLowerCase().includes(keyword.toLowerCase());
}

/**
 * 投票解析：判定"关键词+选项编号/选项文字"是否构成一次有效投票。
 * 投票未开启、关键词不匹配、或该用户已投过票时返回 null。
 */
export function resolveVote(
  danmu: Danmu,
  session: VoteSession,
  votedUsernames: Record<string, string>
): VoteOption | null {
  if (!session.active) return null;
  const content = danmu.content.trim();
  if (!content.startsWith(session.keyword)) return null;
  if (votedUsernames[danmu.username] !== undefined) return null;

  const optionId = content.replace(session.keyword, '').trim();
  return session.options.find(o => o.id === optionId || o.text === optionId) ?? null;
}

/**
 * 清洗 localStorage 读到的自动回复规则：过滤掉结构不完整或空关键词/空回复的条目。
 */
export function sanitizeAutoReplyRules(rules: unknown): AutoReplyRule[] {
  if (!Array.isArray(rules)) return [];
  return rules.filter((r): r is AutoReplyRule =>
    r != null &&
    typeof r.id === 'string' &&
    typeof r.keyword === 'string' && r.keyword.trim() !== '' &&
    typeof r.reply === 'string' && r.reply.trim() !== ''
  );
}

/**
 * 清洗 localStorage 读到的礼物回复规则：过滤掉结构不完整或空礼物名/空模板的条目。
 */
export function sanitizeGiftReplyRules(rules: unknown): GiftReplyRule[] {
  if (!Array.isArray(rules)) return [];
  return rules.filter((r): r is GiftReplyRule =>
    r != null &&
    typeof r.id === 'string' &&
    typeof r.giftName === 'string' && r.giftName.trim() !== '' &&
    typeof r.replyTemplate === 'string' && r.replyTemplate.trim() !== ''
  );
}
