import type { Danmu } from '../types/danmu';

interface DanmuItemProps {
  danmu: Danmu;
  index: number;
}

export function DanmuItem({ danmu, index }: DanmuItemProps) {
  const time = new Date(danmu.timestamp);
  const timeStr = time.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return (
    <div
      className={`
        relative py-3 px-4 rounded-xl backdrop-blur-sm
        border transition-all duration-300
        ${danmu.isReply
          ? 'bg-gradient-to-r from-purple-600/40 to-violet-600/40 border-purple-400/50 ml-4'
          : 'bg-white/5 border-white/10 hover:bg-white/10'
        }
      `}
      style={{
        animationDelay: `${index * 50}ms`,
        animation: 'slideIn 0.3s ease-out forwards'
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
          style={{ backgroundColor: danmu.color || '#8B5CF6' }}
        >
          {danmu.username.charAt(0)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="font-semibold text-sm"
              style={{ color: danmu.color || '#A78BFA' }}
            >
              {danmu.username}
            </span>
            <span className="text-xs text-purple-300/50">{timeStr}</span>
            {danmu.isReply && (
              <span className="text-xs bg-purple-500/30 text-purple-200 px-2 py-0.5 rounded">
                我的回复
              </span>
            )}
          </div>
          <p className={`text-sm leading-relaxed ${danmu.isReply ? 'text-purple-100' : 'text-purple-200/80'}`}>
            {danmu.content}
          </p>
        </div>
      </div>
    </div>
  );
}
