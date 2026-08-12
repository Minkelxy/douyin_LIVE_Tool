import { describe, it, expect } from 'vitest';
import type { Danmu } from '../types/danmu';
import type { AutoReplyRule, GiftReplyRule, VoteSession } from '../types/interaction';
import {
  matchAutoReply,
  matchGiftReply,
  canJoinLottery,
  resolveVote,
  sanitizeAutoReplyRules,
  sanitizeGiftReplyRules
} from './interactions';

function danmu(content: string, username = '观众A'): Danmu {
  return { id: '1', username, content, timestamp: 0, color: '#fff' };
}

function autoReplyRules(overrides: Partial<AutoReplyRule>[] = []): AutoReplyRule[] {
  const base: AutoReplyRule[] = [
    { id: '1', keyword: '666', reply: '666！感谢支持！', enabled: true },
    { id: '2', keyword: '关注', reply: '感谢关注！', enabled: true },
  ];
  return base.map((r, i) => ({ ...r, ...(overrides[i] ?? {}) }));
}

const giftRule: GiftReplyRule = {
  id: '1',
  giftName: '小心心',
  replyTemplate: '感谢 {user} 送的 {gift}！',
  enabled: true,
};

const voteSession: VoteSession = {
  id: '1',
  title: '玩什么',
  options: [
    { id: '1', text: '王者荣耀', votes: 0 },
    { id: '2', text: '英雄联盟', votes: 0 },
  ],
  active: true,
  keyword: '投票',
  createdAt: 0,
};

describe('matchAutoReply', () => {
  it('关键词包含匹配，返回命中规则的回复', () => {
    expect(matchAutoReply(danmu('666666'), autoReplyRules())).toBe('666！感谢支持！');
  });

  it('关键词匹配忽略大小写', () => {
    const rules = autoReplyRules([{ id: '1', keyword: 'hello', reply: 'hi', enabled: true }]);
    expect(matchAutoReply(danmu('Hello World'), rules)).toBe('hi');
  });

  it('未命中任何规则返回 null', () => {
    expect(matchAutoReply(danmu('随便说点啥'), autoReplyRules())).toBeNull();
  });

  it('被禁用的规则跳过', () => {
    const rules = autoReplyRules([{ enabled: false }]);
    expect(matchAutoReply(danmu('666'), rules)).toBeNull();
  });

  it('空关键词规则不参与匹配，避免对每条弹幕都命中', () => {
    const rules = [{ id: 'x', keyword: '  ', reply: '不该触发', enabled: true }];
    expect(matchAutoReply(danmu('任意弹幕'), rules)).toBeNull();
  });

  it('多条规则命中时返回第一条', () => {
    const rules = autoReplyRules([{ keyword: '66' }, { keyword: '666' }]);
    expect(matchAutoReply(danmu('666'), rules)).toBe('666！感谢支持！');
  });

  it('exact 模式要求弹幕与关键词完全一致', () => {
    const rules = autoReplyRules([{ keyword: '666', matchMode: 'exact' }]);
    expect(matchAutoReply(danmu('666'), rules)).toBe('666！感谢支持！');
    expect(matchAutoReply(danmu('6666'), rules)).toBeNull();
    expect(matchAutoReply(danmu(' 666 '), rules)).toBeNull(); // 含空白不算完全一致
  });

  it('matchMode 缺省或 contains 时按包含匹配', () => {
    const withContains = autoReplyRules([{ keyword: '666', matchMode: 'contains' }]);
    const withUndefined = autoReplyRules([{ keyword: '666' }]);
    expect(matchAutoReply(danmu('6666'), withContains)).toBe('666！感谢支持！');
    expect(matchAutoReply(danmu('6666'), withUndefined)).toBe('666！感谢支持！');
  });

  it('exact 模式忽略大小写', () => {
    const rules = autoReplyRules([{ keyword: 'ok', matchMode: 'exact' }]);
    expect(matchAutoReply(danmu('OK'), rules)).toBe('666！感谢支持！');
  });
});

describe('matchGiftReply', () => {
  it('解析 [礼物] 名 x数量 并替换模板变量', () => {
    const result = matchGiftReply(danmu('[礼物] 小心心 x3'), [giftRule]);
    expect(result).toBe('感谢 观众A 送的 小心心 x3！');
  });

  it('非礼物弹幕返回 null', () => {
    expect(matchGiftReply(danmu('普通弹幕'), [giftRule])).toBeNull();
  });

  it('礼物名未命中规则返回 null', () => {
    expect(matchGiftReply(danmu('[礼物] 大金链子 x1'), [giftRule])).toBeNull();
  });

  it('礼物名匹配忽略大小写', () => {
    const result = matchGiftReply(danmu('[礼物] 小心心 x1'), [{ ...giftRule, giftName: '小心' }]);
    expect(result).toBe('感谢 观众A 送的 小心心 x1！');
  });

  it('被禁用的规则跳过', () => {
    expect(matchGiftReply(danmu('[礼物] 小心心 x1'), [{ ...giftRule, enabled: false }])).toBeNull();
  });
});

describe('canJoinLottery', () => {
  it('弹幕包含关键词可参与', () => {
    expect(canJoinLottery(danmu('我要抽奖'), '抽奖', [])).toBe(true);
  });

  it('已参与过的用户不能重复参与', () => {
    const participants = [{ id: '1', username: '观众A', content: '抽奖', timestamp: 0 }];
    expect(canJoinLottery(danmu('再抽一次'), '抽奖', participants)).toBe(false);
  });

  it('关键词为空（抽奖未开）不能参与', () => {
    expect(canJoinLottery(danmu('抽奖'), '', [])).toBe(false);
  });

  it('弹幕不含关键词不能参与', () => {
    expect(canJoinLottery(danmu('今天天气不错'), '抽奖', [])).toBe(false);
  });

  it('关键词匹配忽略大小写', () => {
    expect(canJoinLottery(danmu('LUCKY'), 'lucky', [])).toBe(true);
  });
});

describe('resolveVote', () => {
  it('按选项编号解析「关键词+编号」', () => {
    expect(resolveVote(danmu('投票1'), voteSession, {})?.id).toBe('1');
    expect(resolveVote(danmu('投票 2'), voteSession, {})?.id).toBe('2');
  });

  it('支持按选项文字投票', () => {
    expect(resolveVote(danmu('投票 王者荣耀'), voteSession, {})?.id).toBe('1');
  });

  it('关键词不匹配返回 null', () => {
    expect(resolveVote(danmu('抽奖1'), voteSession, {})).toBeNull();
  });

  it('选项编号不存在返回 null', () => {
    expect(resolveVote(danmu('投票3'), voteSession, {})).toBeNull();
  });

  it('投票已结束返回 null', () => {
    expect(resolveVote(danmu('投票1'), { ...voteSession, active: false }, {})).toBeNull();
  });

  it('同一用户已投过票不能重复投', () => {
    expect(resolveVote(danmu('投票1', '观众A'), voteSession, { '观众A': '2' })).toBeNull();
  });
});

describe('sanitize 规则清洗', () => {
  it('非数组输入返回空数组', () => {
    expect(sanitizeAutoReplyRules('oops')).toEqual([]);
    expect(sanitizeGiftReplyRules(null)).toEqual([]);
  });

  it('过滤掉空关键词/空回复的自动回复规则', () => {
    const raw = [
      { id: '1', keyword: '你好', reply: '你好呀', enabled: true },
      { id: '2', keyword: '   ', reply: '空关键词', enabled: true },
      { id: '3', keyword: '关注', reply: '', enabled: true },
      null,
      { keyword: '缺 id', reply: 'x', enabled: true },
    ];
    const cleaned = sanitizeAutoReplyRules(raw);
    expect(cleaned).toHaveLength(1);
    expect(cleaned[0]).toMatchObject({ id: '1', keyword: '你好' });
  });

  it('过滤掉空礼物名/空模板的礼物规则', () => {
    const raw = [
      { id: '1', giftName: '小心心', replyTemplate: '感谢', enabled: true },
      { id: '2', giftName: '', replyTemplate: '感谢', enabled: true },
    ];
    const cleaned = sanitizeGiftReplyRules(raw);
    expect(cleaned).toHaveLength(1);
    expect(cleaned[0].id).toBe('1');
  });
});
