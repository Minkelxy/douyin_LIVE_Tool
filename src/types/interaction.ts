/** 自动回复匹配方式：contains=包含，exact=完全一致 */
export type MatchMode = 'contains' | 'exact';

export interface AutoReplyRule {
  id: string;
  keyword: string;
  reply: string;
  enabled: boolean;
  /** 缺省视为 contains（兼容旧数据） */
  matchMode?: MatchMode;
}

export interface LotteryParticipant {
  id: string;
  username: string;
  content: string;
  timestamp: number;
}

export interface LotteryResult {
  winner: LotteryParticipant;
  participantsCount: number;
  timestamp: number;
}

export interface VoteOption {
  id: string;
  text: string;
  votes: number;
}

export interface VoteSession {
  id: string;
  title: string;
  options: VoteOption[];
  active: boolean;
  keyword: string;
  createdAt: number;
}

export interface GiftMessage {
  id: string;
  username: string;
  giftName: string;
  giftCount: number;
  timestamp: number;
}

export interface GiftReplyRule {
  id: string;
  giftName: string;
  replyTemplate: string;
  enabled: boolean;
}