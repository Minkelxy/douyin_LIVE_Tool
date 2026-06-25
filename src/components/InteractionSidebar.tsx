import { useState } from 'react';
import { MessageSquare, Gift, Vote, Trophy, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { AutoReplyPanel } from './AutoReplyPanel';
import { LotteryPanel } from './LotteryPanel';
import { VotePanel } from './VotePanel';
import { GiftReplyPanel } from './GiftReplyPanel';
import type { AutoReplyRule, LotteryResult, VoteSession, VoteOption, GiftReplyRule } from '../types/interaction';

interface InteractionSidebarProps {
  // 自动回复
  autoReplyRules: AutoReplyRule[];
  onAddAutoReply: (keyword: string, reply: string) => void;
  onRemoveAutoReply: (id: string) => void;
  onUpdateAutoReply: (id: string, updates: Partial<AutoReplyRule>) => void;

  // 抽奖
  lotteryActive: boolean;
  lotteryKeyword: string;
  lotteryParticipantsCount: number;
  lotteryResult: LotteryResult | null;
  onStartLottery: (keyword: string) => void;
  onDrawLottery: () => void;
  onStopLottery: () => void;

  // 投票
  voteSession: VoteSession | null;
  onStartVote: (title: string, options: string[], keyword: string) => void;
  onEndVote: () => void;
  getVoteResults: () => VoteOption[] | null;

  // 礼物感谢
  giftReplyRules: GiftReplyRule[];
  onAddGiftReply: (giftName: string, replyTemplate: string) => void;
  onRemoveGiftReply: (id: string) => void;
  onUpdateGiftReply: (id: string, updates: Partial<GiftReplyRule>) => void;
}

type TabType = 'autoReply' | 'lottery' | 'vote' | 'giftReply';

const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
  { id: 'autoReply', label: '自动回复', icon: <MessageSquare className="w-4 h-4" /> },
  { id: 'lottery', label: '抽奖', icon: <Trophy className="w-4 h-4" /> },
  { id: 'vote', label: '投票', icon: <Vote className="w-4 h-4" /> },
  { id: 'giftReply', label: '礼物感谢', icon: <Gift className="w-4 h-4" /> },
];

export function InteractionSidebar({
  autoReplyRules,
  onAddAutoReply,
  onRemoveAutoReply,
  onUpdateAutoReply,
  lotteryActive,
  lotteryKeyword,
  lotteryParticipantsCount,
  lotteryResult,
  onStartLottery,
  onDrawLottery,
  onStopLottery,
  voteSession,
  onStartVote,
  onEndVote,
  getVoteResults,
  giftReplyRules,
  onAddGiftReply,
  onRemoveGiftReply,
  onUpdateGiftReply,
}: InteractionSidebarProps) {
  const [activeTab, setActiveTab] = useState<TabType>('autoReply');
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <div className="w-12 bg-gradient-to-b from-purple-900/50 to-indigo-900/50 border-l border-purple-500/30 flex flex-col items-center py-4 gap-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setCollapsed(false);
            }}
            className={`p-2 rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-purple-600 text-white'
                : 'text-purple-400 hover:bg-purple-800/50'
            }`}
          >
            {tab.icon}
          </button>
        ))}
        <button
          onClick={() => setCollapsed(false)}
          className="p-2 text-purple-400 hover:text-purple-200"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-80 bg-gradient-to-b from-purple-900/50 to-indigo-900/50 border-l border-purple-500/30 flex flex-col">
      {/* 标签栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-purple-500/20">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-purple-400" />
          <span className="text-purple-200 font-semibold">互动工具</span>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 text-purple-400 hover:text-purple-200"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 标签切换 */}
      <div className="flex gap-1 px-2 py-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-purple-600 text-white'
                : 'text-purple-400 hover:bg-purple-800/50'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
        {activeTab === 'autoReply' && (
          <AutoReplyPanel
            rules={autoReplyRules}
            onAdd={onAddAutoReply}
            onRemove={onRemoveAutoReply}
            onUpdate={onUpdateAutoReply}
          />
        )}

        {activeTab === 'lottery' && (
          <LotteryPanel
            active={lotteryActive}
            keyword={lotteryKeyword}
            participantsCount={lotteryParticipantsCount}
            result={lotteryResult}
            onStart={onStartLottery}
            onDraw={onDrawLottery}
            onStop={onStopLottery}
          />
        )}

        {activeTab === 'vote' && (
          <VotePanel
            session={voteSession}
            onStart={onStartVote}
            onEnd={onEndVote}
            getResults={getVoteResults}
          />
        )}

        {activeTab === 'giftReply' && (
          <GiftReplyPanel
            rules={giftReplyRules}
            onAdd={onAddGiftReply}
            onRemove={onRemoveGiftReply}
            onUpdate={onUpdateGiftReply}
          />
        )}
      </div>
    </div>
  );
}