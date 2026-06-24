import { useState } from 'react';
import { Vote, CheckCircle2, StopCircle, BarChart3 } from 'lucide-react';
import type { VoteSession, VoteOption } from '../types/interaction';

interface VotePanelProps {
  session: VoteSession | null;
  onStart: (title: string, options: string[], keyword: string) => void;
  onEnd: () => void;
  getResults: () => VoteOption[] | null;
}

export function VotePanel({ session, onStart, onEnd, getResults }: VotePanelProps) {
  const [title, setTitle] = useState('');
  const [optionsText, setOptionsText] = useState('');
  const [keyword, setKeyword] = useState('');
  const [showResults, setShowResults] = useState(false);

  const handleStart = () => {
    if (title.trim() && optionsText.trim() && keyword.trim()) {
      const options = optionsText.split('\n').filter(o => o.trim());
      if (options.length >= 2) {
        onStart(title.trim(), options, keyword.trim());
        setTitle('');
        setOptionsText('');
        setKeyword('');
      }
    }
  };

  const results = getResults();

  if (session && !session.active && showResults && results) {
    return (
      <div className="bg-purple-950/30 rounded-xl p-4 border border-purple-500/20">
        <h3 className="text-lg font-semibold text-purple-200 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-cyan-400" />
          投票结果：{session.title}
        </h3>

        <div className="space-y-3">
          {results.map((option, index) => (
            <div key={option.id} className="relative">
              <div className="flex items-center justify-between mb-1">
                <span className="text-purple-200">{option.text}</span>
                <span className="text-cyan-400 font-bold">{option.votes} 票</span>
              </div>
              <div className="h-6 bg-purple-900/50 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    index === 0 ? 'bg-gradient-to-r from-emerald-500 to-cyan-500' : 'bg-purple-600'
                  }`}
                  style={{
                    width: `${Math.max(5, (option.votes / Math.max(1, ...results.map(r => r.votes))) * 100)}%`
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => setShowResults(false)}
          className="w-full mt-4 px-4 py-2 bg-purple-500/20 border border-purple-500/50 text-purple-300 rounded-lg hover:bg-purple-500/30"
        >
          关闭结果
        </button>
      </div>
    );
  }

  return (
    <div className="bg-purple-950/30 rounded-xl p-4 border border-purple-500/20">
      <h3 className="text-lg font-semibold text-purple-200 mb-4 flex items-center gap-2">
        <Vote className="w-5 h-5 text-cyan-400" />
        弹幕投票
      </h3>

      {!session ? (
        // 创建投票
        <div className="space-y-3">
          <input
            type="text"
            placeholder="投票主题（如：今天播什么游戏）"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-purple-950/50 border border-purple-500/30 rounded-lg px-3 py-2 text-sm text-purple-100 placeholder-purple-400/50 focus:outline-none focus:border-purple-400"
          />

          <textarea
            placeholder="投票选项（每行一个选项）&#10;如：&#10;王者荣耀&#10;英雄联盟&#10;原神"
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            rows={4}
            className="w-full bg-purple-950/50 border border-purple-500/30 rounded-lg px-3 py-2 text-sm text-purple-100 placeholder-purple-400/50 focus:outline-none focus:border-purple-400 resize-none"
          />

          <input
            type="text"
            placeholder="投票关键词（如：投票）"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="w-full bg-purple-950/50 border border-purple-500/30 rounded-lg px-3 py-2 text-sm text-purple-100 placeholder-purple-400/50 focus:outline-none focus:border-purple-400"
          />

          <p className="text-purple-400/50 text-xs">
            观众发送「关键词 + 选项编号」投票，如：投票 1
          </p>

          <button
            onClick={handleStart}
            disabled={!title.trim() || !optionsText.trim() || !keyword.trim()}
            className="w-full px-4 py-2 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/50 text-cyan-400 rounded-lg font-medium hover:from-cyan-500/30 hover:to-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            开始投票
          </button>
        </div>
      ) : session.active ? (
        // 投票进行中
        <div className="space-y-4">
          <div className="text-center">
            <span className="text-lg font-bold text-purple-200">{session.title}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {session.options.map((option) => (
              <div
                key={option.id}
                className="bg-purple-800/30 rounded-lg p-3 text-center"
              >
                <span className="text-cyan-400 font-bold text-lg">{option.id}</span>
                <p className="text-purple-200 text-sm mt-1">{option.text}</p>
                <p className="text-purple-400/70 text-xs mt-2">{option.votes} 票</p>
              </div>
            ))}
          </div>

          <p className="text-purple-400/50 text-xs text-center">
            发送「{session.keyword} + 编号」投票
          </p>

          <div className="flex gap-2">
            <button
              onClick={onEnd}
              className="flex-1 px-4 py-2 bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg hover:bg-red-500/30 flex items-center justify-center gap-2"
            >
              <StopCircle className="w-4 h-4" />
              结束投票
            </button>
          </div>
        </div>
      ) : (
        // 投票已结束
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span className="text-emerald-400 font-medium">投票已结束</span>
          </div>

          <button
            onClick={() => setShowResults(true)}
            className="w-full px-4 py-2 bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 rounded-lg hover:bg-cyan-500/30"
          >
            查看结果
          </button>

          <button
            onClick={onEnd}
            className="w-full px-4 py-2 bg-purple-500/20 border border-purple-500/50 text-purple-300 rounded-lg hover:bg-purple-500/30"
          >
            开始新投票
          </button>
        </div>
      )}
    </div>
  );
}