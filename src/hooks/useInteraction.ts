import { useState, useCallback, useEffect } from 'react';
import type { Danmu } from '../types/danmu';
import type { AutoReplyRule, LotteryParticipant, LotteryResult, VoteSession, VoteOption, GiftMessage, GiftReplyRule } from '../types/interaction';

const STORAGE_KEY_AUTO_REPLY = 'danmu_auto_reply_rules';
const STORAGE_KEY_GIFT_REPLY = 'danmu_gift_reply_rules';

export function useInteraction() {
  // 自动回复规则
  const [autoReplyRules, setAutoReplyRules] = useState<AutoReplyRule[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_AUTO_REPLY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [
      { id: '1', keyword: '你好', reply: '你好呀！欢迎来到直播间~', enabled: true },
      { id: '2', keyword: '关注', reply: '感谢关注！点点关注不迷路~', enabled: true },
      { id: '3', keyword: '666', reply: '666！感谢支持！', enabled: true },
    ];
  });

  // 礼物感谢规则
  const [giftReplyRules, setGiftReplyRules] = useState<GiftReplyRule[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_GIFT_REPLY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [
      { id: '1', giftName: '小心心', replyTemplate: '感谢 {user} 送的 {gift}！爱你~', enabled: true },
      { id: '2', giftName: '玫瑰', replyTemplate: '感谢 {user} 送的 {gift}！太浪漫了~', enabled: true },
      { id: '3', giftName: '火箭', replyTemplate: '哇！感谢 {user} 送的 {gift}！大气！', enabled: true },
    ];
  });

  // 抽奖状态
  const [lotteryActive, setLotteryActive] = useState(false);
  const [lotteryKeyword, setLotteryKeyword] = useState('');
  const [lotteryParticipants, setLotteryParticipants] = useState<LotteryParticipant[]>([]);
  const [lotteryResult, setLotteryResult] = useState<LotteryResult | null>(null);

  // 投票状态
  const [voteSession, setVoteSession] = useState<VoteSession | null>(null);
  const [voteResults, setVoteResults] = useState<Record<string, string[]>>({});

  // 自动回复处理
  const processAutoReply = useCallback((danmu: Danmu): string | null => {
    const enabledRules = autoReplyRules.filter(r => r.enabled);
    for (const rule of enabledRules) {
      if (danmu.content.toLowerCase().includes(rule.keyword.toLowerCase())) {
        return rule.reply;
      }
    }
    return null;
  }, [autoReplyRules]);

  // 添加自动回复规则
  const addAutoReplyRule = useCallback((keyword: string, reply: string) => {
    const newRule: AutoReplyRule = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      keyword,
      reply,
      enabled: true
    };
    setAutoReplyRules(prev => [...prev, newRule]);
  }, []);

  // 删除自动回复规则
  const removeAutoReplyRule = useCallback((id: string) => {
    setAutoReplyRules(prev => prev.filter(r => r.id !== id));
  }, []);

  // 更新自动回复规则
  const updateAutoReplyRule = useCallback((id: string, updates: Partial<AutoReplyRule>) => {
    setAutoReplyRules(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  }, []);

  // 开始抽奖
  const startLottery = useCallback((keyword: string) => {
    setLotteryKeyword(keyword);
    setLotteryParticipants([]);
    setLotteryResult(null);
    setLotteryActive(true);
  }, []);

  // 处理抽奖参与
  const processLottery = useCallback((danmu: Danmu): boolean => {
    if (!lotteryActive || !lotteryKeyword) return false;

    if (danmu.content.toLowerCase().includes(lotteryKeyword.toLowerCase())) {
      const participant: LotteryParticipant = {
        id: danmu.id,
        username: danmu.username,
        content: danmu.content,
        timestamp: danmu.timestamp
      };
      let added = false;
      setLotteryParticipants(prev => {
        if (prev.some(p => p.username === danmu.username)) return prev;
        added = true;
        return [...prev, participant];
      });
      return added;
    }
    return false;
  }, [lotteryActive, lotteryKeyword]);

  // 执行抽奖
  const drawLottery = useCallback(() => {
    if (lotteryParticipants.length === 0) {
      setLotteryResult(null);
      return null;
    }

    const winnerIndex = Math.floor(Math.random() * lotteryParticipants.length);
    const winner = lotteryParticipants[winnerIndex];
    
    const result: LotteryResult = {
      winner,
      participantsCount: lotteryParticipants.length,
      timestamp: Date.now()
    };
    
    setLotteryResult(result);
    setLotteryActive(false);
    return result;
  }, [lotteryParticipants]);

  // 停止抽奖
  const stopLottery = useCallback(() => {
    setLotteryActive(false);
    setLotteryParticipants([]);
    setLotteryResult(null);
  }, []);

  // 开始投票
  const startVote = useCallback((title: string, options: string[], keyword: string) => {
    const voteOptions: VoteOption[] = options.map((text, index) => ({
      id: `${index}`,
      text,
      votes: 0
    }));

    const session: VoteSession = {
      id: `${Date.now()}`,
      title,
      options: voteOptions,
      active: true,
      keyword,
      createdAt: Date.now()
    };

    setVoteSession(session);
    setVoteResults({});
  }, []);

  // 处理投票
  const processVote = useCallback((danmu: Danmu): boolean => {
    if (!voteSession || !voteSession.active) return false;

    const content = danmu.content.trim();

    // 检查是否是投票关键词+选项编号
    if (content.startsWith(voteSession.keyword)) {
      const optionId = content.replace(voteSession.keyword, '').trim();

      // 检查选项是否有效
      const option = voteSession.options.find(o => o.id === optionId || o.text === optionId);
      if (option) {
        let voted = false;
        setVoteResults(prev => {
          if (prev[danmu.username]) return prev;
          voted = true;
          return { ...prev, [danmu.username]: [option.id] };
        });
        if (voted) {
          setVoteSession(prev => prev ? {
            ...prev,
            options: prev.options.map(o => o.id === option.id ? { ...o, votes: o.votes + 1 } : o)
          } : null);
        }
        return voted;
      }
    }
    return false;
  }, [voteSession]);

  // 结束投票
  const endVote = useCallback(() => {
    if (voteSession) {
      setVoteSession(prev => prev ? { ...prev, active: false } : null);
    }
  }, []);

  // 获取投票结果
  const getVoteResults = useCallback(() => {
    if (!voteSession) return null;
    return [...voteSession.options].sort((a, b) => b.votes - a.votes);
  }, [voteSession]);

  // 处理礼物感谢
  const processGiftReply = useCallback((danmu: Danmu): string | null => {
    // 匹配 [礼物] 礼物名 x数量 格式
    const match = danmu.content.match(/^\[礼物\] (.+?) x(\d+)$/);
    if (!match) return null;
    const giftName = match[1];
    const giftCount = parseInt(match[2], 10);
    const enabledRules = giftReplyRules.filter(r => r.enabled);
    for (const rule of enabledRules) {
      if (giftName.toLowerCase().includes(rule.giftName.toLowerCase())) {
        return rule.replyTemplate
          .replace('{user}', danmu.username)
          .replace('{gift}', `${giftName} x${giftCount}`);
      }
    }
    return null;
  }, [giftReplyRules]);

  // 添加礼物感谢规则
  const addGiftReplyRule = useCallback((giftName: string, replyTemplate: string) => {
    const newRule: GiftReplyRule = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      giftName,
      replyTemplate,
      enabled: true
    };
    setGiftReplyRules(prev => [...prev, newRule]);
  }, []);

  // 删除礼物感谢规则
  const removeGiftReplyRule = useCallback((id: string) => {
    setGiftReplyRules(prev => prev.filter(r => r.id !== id));
  }, []);

  // 更新礼物感谢规则
  const updateGiftReplyRule = useCallback((id: string, updates: Partial<GiftReplyRule>) => {
    setGiftReplyRules(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  }, []);

  // 保存到localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_AUTO_REPLY, JSON.stringify(autoReplyRules));
  }, [autoReplyRules]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_GIFT_REPLY, JSON.stringify(giftReplyRules));
  }, [giftReplyRules]);

  return {
    // 自动回复
    autoReplyRules,
    processAutoReply,
    addAutoReplyRule,
    removeAutoReplyRule,
    updateAutoReplyRule,

    // 抽奖
    lotteryActive,
    lotteryKeyword,
    lotteryParticipants,
    lotteryResult,
    startLottery,
    processLottery,
    drawLottery,
    stopLottery,

    // 投票
    voteSession,
    voteResults,
    startVote,
    processVote,
    endVote,
    getVoteResults,

    // 礼物感谢
    giftReplyRules,
    processGiftReply,
    addGiftReplyRule,
    removeGiftReplyRule,
    updateGiftReplyRule,
  };
}