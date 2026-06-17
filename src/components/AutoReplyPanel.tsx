import { useState } from 'react';
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import type { AutoReplyRule } from '../types/interaction';

interface AutoReplyPanelProps {
  rules: AutoReplyRule[];
  onAdd: (keyword: string, reply: string) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<AutoReplyRule>) => void;
}

export function AutoReplyPanel({ rules, onAdd, onRemove, onUpdate }: AutoReplyPanelProps) {
  const [newKeyword, setNewKeyword] = useState('');
  const [newReply, setNewReply] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKeyword, setEditKeyword] = useState('');
  const [editReply, setEditReply] = useState('');

  const handleAdd = () => {
    if (newKeyword.trim() && newReply.trim()) {
      onAdd(newKeyword.trim(), newReply.trim());
      setNewKeyword('');
      setNewReply('');
    }
  };

  const startEdit = (rule: AutoReplyRule) => {
    setEditingId(rule.id);
    setEditKeyword(rule.keyword);
    setEditReply(rule.reply);
  };

  const saveEdit = () => {
    if (editingId && editKeyword.trim() && editReply.trim()) {
      onUpdate(editingId, { keyword: editKeyword.trim(), reply: editReply.trim() });
      setEditingId(null);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  return (
    <div className="bg-purple-950/30 rounded-xl p-4 border border-purple-500/20">
      <h3 className="text-lg font-semibold text-purple-200 mb-4">自动回复规则</h3>

      {/* 添加新规则 */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="关键词"
          value={newKeyword}
          onChange={(e) => setNewKeyword(e.target.value)}
          className="flex-1 bg-purple-950/50 border border-purple-500/30 rounded-lg px-3 py-2 text-sm text-purple-100 placeholder-purple-400/50 focus:outline-none focus:border-purple-400"
        />
        <input
          type="text"
          placeholder="回复内容"
          value={newReply}
          onChange={(e) => setNewReply(e.target.value)}
          className="flex-[2] bg-purple-950/50 border border-purple-500/30 rounded-lg px-3 py-2 text-sm text-purple-100 placeholder-purple-400/50 focus:outline-none focus:border-purple-400"
        />
        <button
          onClick={handleAdd}
          disabled={!newKeyword.trim() || !newReply.trim()}
          className="p-2 bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 rounded-lg hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* 规则列表 */}
      <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className={`flex items-center gap-2 p-3 rounded-lg ${
              rule.enabled ? 'bg-purple-800/30' : 'bg-purple-900/20 opacity-60'
            }`}
          >
            {editingId === rule.id ? (
              <>
                <input
                  type="text"
                  value={editKeyword}
                  onChange={(e) => setEditKeyword(e.target.value)}
                  className="flex-1 bg-purple-950/50 border border-purple-400 rounded px-2 py-1 text-sm text-purple-100"
                />
                <input
                  type="text"
                  value={editReply}
                  onChange={(e) => setEditReply(e.target.value)}
                  className="flex-[2] bg-purple-950/50 border border-purple-400 rounded px-2 py-1 text-sm text-purple-100"
                />
                <button onClick={saveEdit} className="p-1 text-emerald-400 hover:bg-emerald-500/20 rounded">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={cancelEdit} className="p-1 text-red-400 hover:bg-red-500/20 rounded">
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <span className="text-cyan-400 font-medium text-sm w-20 truncate">{rule.keyword}</span>
                <span className="text-purple-200 text-sm flex-1 truncate">{rule.reply}</span>
                <button
                  onClick={() => onUpdate(rule.id, { enabled: !rule.enabled })}
                  className={`w-10 h-5 rounded-full transition-colors ${
                    rule.enabled ? 'bg-emerald-500' : 'bg-purple-700'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    rule.enabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </button>
                <button onClick={() => startEdit(rule)} className="p-1 text-purple-400 hover:text-cyan-400">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => onRemove(rule.id)} className="p-1 text-purple-400 hover:text-red-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        ))}

        {rules.length === 0 && (
          <p className="text-purple-400/50 text-sm text-center py-4">暂无规则，添加关键词触发自动回复</p>
        )}
      </div>
    </div>
  );
}