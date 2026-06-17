import { Wifi, WifiOff, Search, Trash2 } from 'lucide-react';
import type { ConnectionState } from '../types/danmu';

interface HeaderProps {
  connection: ConnectionState;
  filterKeyword: string;
  onFilterChange: (keyword: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onClear: () => void;
}

export function Header({
  connection,
  filterKeyword,
  onFilterChange,
  onConnect,
  onDisconnect,
  onClear
}: HeaderProps) {
  const isConnected = connection.status === 'connected';

  return (
    <header className="bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-900 border-b border-purple-500/30 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            弹幕互动
          </h1>

          <div className="flex items-center gap-2">
            {isConnected ? (
              <Wifi className="w-5 h-5 text-emerald-400" />
            ) : connection.status === 'connecting' ? (
              <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-400" />
            )}
            <span className={`text-sm font-medium ${isConnected ? 'text-emerald-400' : 'text-red-400'}`}>
              {isConnected ? '已连接' : connection.status === 'connecting' ? '连接中...' : '未连接'}
            </span>
          </div>

          <span className="text-xs text-purple-300/70 bg-purple-950/50 px-2 py-1 rounded">
            {connection.platform}
          </span>
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

          {isConnected ? (
            <button
              onClick={onDisconnect}
              className="px-4 py-2 bg-red-500/20 border border-red-500/50 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-colors"
            >
              断开
            </button>
          ) : (
            <button
              onClick={onConnect}
              disabled={connection.status === 'connecting'}
              className="px-4 py-2 bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
            >
              连接
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
