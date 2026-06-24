import { useState } from 'react';
import { Gift, Users, Trophy, StopCircle } from 'lucide-react';
import type { LotteryResult } from '../types/interaction';

interface LotteryPanelProps {
  active: boolean;
  keyword: string;
  participantsCount: number;
  result: LotteryResult | null;
  onStart: (keyword: string) => void;
  onDraw: () => void;
  onStop: () => void;
}

export function LotteryPanel({
  active,
  keyword,
  participantsCount,
  result,
  onStart,
  onDraw,
  onStop
}: LotteryPanelProps) {
  const [inputKeyword, setInputKeyword] = useState('');

  const handleStart = () => {
    if (inputKeyword.trim()) {
      onStart(inputKeyword.trim());
      setInputKeyword('');
    }
  };

  return (
    <div className="bg-purple-950/30 rounded-xl p-4 border border-purple-500/20">
      <h3 className="text-lg font-semibold text-purple-200 mb-4 flex items-center gap-2">
        <Gift className="w-5 h-5 text-yellow-400" />
        弹幕抽奖
      </h3>

      {!active && !result ? (
        // 开始抽奖
        <div className="space-y-3">
          <p className="text-purple-300/70 text-sm">设置抽奖关键词，观众发送包含关键词的弹幕即可参与</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="抽奖关键词（如：抽奖）"
              value={inputKeyword}
              onChange={(e) => setInputKeyword(e.target.value)}
              className="flex-1 bg-purple-950/50 border border-purple-500/30 rounded-lg px-3 py-2 text-sm text-purple-100 placeholder-purple-400/50 focus:outline-none focus:border-purple-400"
            />
            <button
              onClick={handleStart}
              disabled={!inputKeyword.trim()}
              className="px-4 py-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/50 text-yellow-400 rounded-lg font-medium hover:from-yellow-500/30 hover:to-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              开始抽奖
            </button>
          </div>
        </div>
      ) : active ? (
        // 抽奖进行中
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-purple-300 text-sm">关键词：</span>
              <span className="text-cyan-400 font-bold">{keyword}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-400" />
              <span className="text-purple-200 font-medium">{participantsCount} 人参与</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onDraw}
              disabled={participantsCount === 0}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/50 text-emerald-400 rounded-lg font-bold hover:from-emerald-500/30 hover:to-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Trophy className="w-5 h-5" />
              抽取中奖者
            </button>
            <button
              onClick={onStop}
              className="px-4 py-3 bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg hover:bg-red-500/30 flex items-center justify-center gap-2"
            >
              <StopCircle className="w-5 h-5" />
              停止
            </button>
          </div>

          <p className="text-purple-400/50 text-xs text-center">观众发送「{keyword}」即可参与抽奖</p>
        </div>
      ) : result ? (
        // 抽奖结果
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-xl p-4 border border-yellow-500/30">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Trophy className="w-6 h-6 text-yellow-400" />
              <span className="text-yellow-400 font-bold text-lg">中奖者</span>
            </div>
            <div className="text-center">
              <span className="text-2xl font-bold text-white">{result.winner.username}</span>
              <p className="text-purple-300/70 text-sm mt-1">「{result.winner.content}」</p>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-purple-300">参与人数：{result.participantsCount}</span>
            <span className="text-purple-400/50">
              {new Date(result.timestamp).toLocaleTimeString('zh-CN')}
            </span>
          </div>

          <button
            onClick={onStop}
            className="w-full px-4 py-2 bg-purple-500/20 border border-purple-500/50 text-purple-300 rounded-lg hover:bg-purple-500/30"
          >
            清除结果，开始新抽奖
          </button>
        </div>
      ) : null}
    </div>
  );
}