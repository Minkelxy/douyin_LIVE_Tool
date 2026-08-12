// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useInteraction } from './useInteraction';
import type { Danmu } from '../types/danmu';

function danmu(content: string, username = '观众A', id = '1'): Danmu {
  return { id, username, content, timestamp: Date.now(), color: '#fff' };
}

const KEY_AUTO = 'danmu_auto_reply_rules';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('useInteraction 规则加载', () => {
  it('localStorage 为空时使用默认规则', () => {
    const { result } = renderHook(() => useInteraction());
    expect(result.current.autoReplyRules).toHaveLength(3);
    expect(result.current.giftReplyRules).toHaveLength(3);
  });

  it('localStorage 损坏时回退默认规则', () => {
    localStorage.setItem(KEY_AUTO, 'not-json{');
    const { result } = renderHook(() => useInteraction());
    expect(result.current.autoReplyRules).toHaveLength(3);
  });

  it('清洗掉空关键词/空回复的规则，保留合法规则', () => {
    localStorage.setItem(KEY_AUTO, JSON.stringify([
      { id: 'a', keyword: '你好', reply: '你好呀', enabled: true },
      { id: 'b', keyword: '  ', reply: '空关键词', enabled: true },
      null,
    ]));
    const { result } = renderHook(() => useInteraction());
    expect(result.current.autoReplyRules).toHaveLength(1);
    expect(result.current.autoReplyRules[0].id).toBe('a');
  });
});

describe('useInteraction 自动回复与礼物', () => {
  it('processAutoReply 命中默认规则', () => {
    const { result } = renderHook(() => useInteraction());
    expect(result.current.processAutoReply(danmu('666666'))).toBe('666！感谢支持！');
    expect(result.current.processAutoReply(danmu('随便说说'))).toBeNull();
  });

  it('processGiftReply 解析礼物弹幕并替换模板', () => {
    const { result } = renderHook(() => useInteraction());
    expect(result.current.processGiftReply(danmu('[礼物] 小心心 x2'))).toBe('感谢 观众A 送的 小心心 x2！爱你~');
    expect(result.current.processGiftReply(danmu('普通弹幕'))).toBeNull();
  });
});

describe('useInteraction 投票', () => {
  it('计票一次并防止同一用户重复投票', () => {
    const { result } = renderHook(() => useInteraction());

    act(() => result.current.startVote('玩什么', ['王者荣耀', '英雄联盟'], '投票'));

    // 观众A 投 1
    act(() => {
      const added = result.current.processVote(danmu('投票1', '观众A'));
      expect(added).toBe(true);
    });
    expect(result.current.voteSession?.options[0].votes).toBe(1);

    // 观众A 再投一次（不同弹幕 id）→ 拒绝，票数不变
    act(() => {
      const added = result.current.processVote(danmu('投票1', '观众A', '2'));
      expect(added).toBe(false);
    });
    expect(result.current.voteSession?.options[0].votes).toBe(1);

    // 观众B 投 2
    act(() => {
      expect(result.current.processVote(danmu('投票2', '观众B'))).toBe(true);
    });
    expect(result.current.voteSession?.options[1].votes).toBe(1);
  });

  it('结束投票后不再计票，resetVote 清空会话', () => {
    const { result } = renderHook(() => useInteraction());

    act(() => result.current.startVote('玩什么', ['A', 'B'], '投票'));
    act(() => result.current.endVote());

    // 已结束，投票不生效
    act(() => {
      expect(result.current.processVote(danmu('投票1', '观众A'))).toBe(false);
    });

    // resetVote 清空会话，回到可新建状态
    act(() => result.current.resetVote());
    expect(result.current.voteSession).toBeNull();
    expect(result.current.getVoteResults()).toBeNull();
  });
});

describe('useInteraction 抽奖', () => {
  it('参与者去重，drawLottery 返回中奖结果', () => {
    const { result } = renderHook(() => useInteraction());

    act(() => result.current.startLottery('抽奖'));

    act(() => {
      expect(result.current.processLottery(danmu('我要抽奖', '观众A'))).toBe(true);
    });
    act(() => {
      // 同一用户重复弹幕不重复参与
      expect(result.current.processLottery(danmu('抽奖', '观众A', '2'))).toBe(false);
    });
    act(() => {
      expect(result.current.processLottery(danmu('抽奖', '观众B'))).toBe(true);
    });

    expect(result.current.lotteryParticipants).toHaveLength(2);

    // 抽奖结果存在 lotteryResult state 中
    act(() => {
      result.current.drawLottery();
    });
    const drawn = result.current.lotteryResult;
    expect(drawn?.participantsCount).toBe(2);
    expect(['观众A', '观众B']).toContain(drawn?.winner.username);
    expect(result.current.lotteryActive).toBe(false);
  });

  it('无参与者时 drawLottery 返回 null', () => {
    const { result } = renderHook(() => useInteraction());
    act(() => result.current.startLottery('抽奖'));
    expect(result.current.lotteryParticipants).toHaveLength(0);
    act(() => {
      result.current.drawLottery();
    });
    expect(result.current.lotteryResult).toBeNull();
  });
});
