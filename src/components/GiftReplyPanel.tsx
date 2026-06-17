import { useState } from 'react';
import { Gift, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import type { GiftReplyRule } from '../types/interaction';

interface GiftReplyPanelProps {
  rules: GiftReplyRule[];
  onAdd: (giftName: string, replyTemplate: string) => void;
  onRemove: (giftName: string) => void;
  onUpdate: (giftName: string, updates: Partial<GiftReplyRule>) => void;
}

export function GiftReplyPanel({ rules, onAdd, onRemove, onUpdate }: GiftReplyPanelProps) {
  const [newGiftName, setNewGiftName] = useState('');
  const [newReplyTemplate, setNewReplyTemplate] = useState('');

  const handleAdd = () => {
    if (newGiftName.trim() && newReplyTemplate.trim()) {
      onAdd(newGiftName.trim(), newReplyTemplate.trim());
      setNewGiftName('');
      setNewReplyTemplate('');
    }
  };

  return (
    <div className="bg-purple-950/30 rounded-xl p-4 border border-purple-500/20">
      <h3 className="text-lg font-semibold text-purple-200 mb-4 flex items-center gap-2">
        <Gift className="w-5 h-5 text-pink-400" />
        礼物感谢自动回复
      </h3>

      {/* 添加新规则 */}
      <div className="space-y-2 mb-4">
        <input
          type="text"
          placeholder="礼物名称（如：小心心）"
          value={newGiftName}
          onChange={(e) => setNewGiftName(e.target.value)}
          className="w-full bg-purple-950/50 border border-purple-500/30 rounded-lg px-3 py-2 text-sm text-purple-100 placeholder-purple-400/50 focus:outline-none focus:border-purple-400"
        />
        <input
          type="text"
          placeholder="回复模板，使用 {user} 和 {gift} 变量"
          value={newReplyTemplate}
          onChange={(e) => setNewReplyTemplate(e.target.value)}
          className="w-full bg-purple-950/50 border border-purple-500/30 rounded-lg px-3 py-2 text-sm text-purple-100 placeholder-purple-400/50 focus:outline-none focus:border-purple-400"
        />
        <p className="text-purple-400/50 text-xs">
          示例：感谢 {'{user}'} 送的 {'{gift}'}！太感谢啦~
        </p>
        <button
          onClick={handleAdd}
          disabled={!newGiftName.trim() || !newReplyTemplate.trim()}
          className="w-full px-4 py-2 bg-pink-500/20 border border-pink-500/50 text-pink-400 rounded-lg font-medium hover:bg-pink-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          添加规则
        </button>
      </div>

      {/* 规则列表 */}
      <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
        {rules.map((rule) => (
          <div
            key={rule.giftName}
            className={`flex items-center gap-2 p-3 rounded-lg ${
              rule.enabled ? 'bg-purple-800/30' : 'bg-purple-900/20 opacity-60'
            }`}
          >
            <span className="text-pink-400 font-medium text-sm w-20 truncate">{rule.giftName}</span>
            <span className="text-purple-200 text-sm flex-1 truncate">{rule.replyTemplate}</span>
            <button
              onClick={() => onUpdate(rule.giftName, { enabled: !rule.enabled })}
              className="p-1"
            >
              {rule.enabled ? (
                <ToggleRight className="w-5 h-5 text-emerald-400" />
              ) : (
                <ToggleLeft className="w-5 h-5 text-purple-400" />
              )}
            </button>
            <button onClick={() => onRemove(rule.giftName)} className="p-1 text-purple-400 hover:text-red-400">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        {rules.length === 0 && (
          <p className="text-purple-400/50 text-sm text-center py-4">暂无规则，添加礼物感谢自动回复</p>
        )}
      </div>
    </div>
  );
}