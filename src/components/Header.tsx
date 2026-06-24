import { Wifi, WifiOff, Search, Trash2, Monitor } from 'lucide-react';
import type { PlatformType } from '../hooks/useDanmu';

interface HeaderProps {
  platform: PlatformType;
  onPlatformChange: (platform: PlatformType) => void;
  roomId: string;
  onRoomIdChange: (roomId: string) => void;
  connected: boolean;
  filterKeyword: string;
  onFilterChange: (keyword: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onClear: () => void;
}

const platforms: { value: PlatformType; label: string; color: string }[] = [
  { value: 'mock', label: '模拟数据', color: 'text-gray-400' },
  { value: 'bilibili', label: 'B站直播', color: 'text-pink-400' },
  { value: 'douyin', label: '抖音直播', color: 'text-cyan-400' }
];

export function Header({
  platform,
  onPlatformChange,
  roomId,
  onRoomIdChange,
  connected,
  filterKeyword,
  onFilterChange,
  onConnect,
  onDisconnect,
  onClear
}: HeaderProps) {
  return (
    <header className="bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-900 border-b border-purple-500/30 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              弹幕互动
            </h1>

            <div className="flex items-center gap-2">
              {connected ? (
                <Wifi className="w-5 h-5 text-emerald-400" />
              ) : (
                <WifiOff className="w-5 h-5 text-red-400" />
              )}
              <span className={`text-sm font-medium ${connected ? 'text-emerald-400' : 'text-red-400'}`}>
                {connected ? '已连接' : '未连接'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-purple-950/50 rounded-lg p-1">
            {platforms.map((p) => (
              <button
                key={p.value}
                onClick={() => onPlatformChange(p.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  platform === p.value
                    ? 'bg-purple-600 text-white'
                    : `${p.color} hover:bg-purple-800/50`
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {platform !== 'mock' && (
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-purple-400" />
              <input
                type="text"
                placeholder="直播间ID"
                value={roomId}
                onChange={(e) => onRoomIdChange(e.target.value)}
                className="bg-purple-950/50 border border-purple-500/30 rounded-lg px-3 py-1.5 text-sm text-purple-100 placeholder-purple-400/50 focus:outline-none focus:border-purple-400 transition-colors w-36"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
            <input
              type="text"
              placeholder="筛选弹幕..."
              value={filterKeyword}
              onChange={(e) => onFilterChange(e.target.value)}
              className="bg-purple-950/50 border border-purple-500/30 rounded-lg pl-10 pr-4 py-2 text-sm text-purple-100 placeholder-purple-400/50 focus:outline-none focus:border-purple-400 transition-colors w-48"
            />
          </div>

          <button
            onClick={onClear}
            className="p-2 text-purple-400 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors"
            title="清空弹幕"
          >
            <Trash2 className="w-5 h-5" />
          </button>

          {connected ? (
            <button
              onClick={onDisconnect}
              className="px-4 py-2 bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-colors"
            >
              断开
            </button>
          ) : (
            <button
              onClick={onConnect}
              disabled={platform !== 'mock' && !roomId.trim()}
              className="px-4 py-2 bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              连接
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
