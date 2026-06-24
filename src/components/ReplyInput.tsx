import { useState } from 'react';
import { Send, Smile } from 'lucide-react';

interface ReplyInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
}

const emojis = ['😀', '😂', '😍', '🤔', '👍', '🎉', '🔥', '❤️', '🚀', '💯'];

export function ReplyInput({ onSend, disabled }: ReplyInputProps) {
  const [message, setMessage] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || disabled) return;

    onSend(message.trim());
    setMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const addEmoji = (emoji: string) => {
    setMessage(prev => prev + emoji);
    setShowEmojis(false);
  };

  return (
    <div className="bg-gradient-to-t from-indigo-950/80 to-purple-950/50 border-t border-purple-500/30 px-6 py-4">
      <form onSubmit={handleSubmit} className="flex items-end gap-3">
        <button
          type="button"
          onClick={() => setShowEmojis(!showEmojis)}
          className="p-3 text-purple-400 hover:text-yellow-400 hover:bg-purple-950/50 rounded-xl transition-colors"
        >
          <Smile className="w-5 h-5" />
        </button>

        <div className="flex-1 relative">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入回复内容..."
            disabled={disabled}
            rows={1}
            className="w-full bg-purple-950/50 border border-purple-500/30 rounded-xl px-4 py-3 text-purple-100 placeholder-purple-400/50 focus:outline-none focus:border-purple-400 resize-none transition-colors disabled:opacity-50"
            style={{ minHeight: '48px', maxHeight: '120px' }}
          />
        </div>

        <button
          type="submit"
          disabled={!message.trim() || disabled}
          className="p-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-purple-600 disabled:hover:to-indigo-600"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>

      {showEmojis && (
        <div className="absolute bottom-full left-6 mb-2 bg-purple-900/95 border border-purple-500/30 rounded-xl p-3 shadow-xl">
          <div className="flex gap-2 flex-wrap max-w-64">
            {emojis.map((emoji, i) => (
              <button
                key={i}
                onClick={() => addEmoji(emoji)}
                className="p-2 hover:bg-purple-800/50 rounded-lg transition-colors text-xl"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
