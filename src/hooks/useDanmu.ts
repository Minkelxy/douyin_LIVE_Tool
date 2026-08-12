import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Danmu } from '../types/danmu';
import { generateRandomDanmu, generateReplyDanmu } from '../utils/mockDanmu';

const MAX_DANMU_COUNT = 50;
const SOCKET_URL = import.meta.env.PROD ? window.location.origin : 'http://localhost:3001';
const SOCKET_PATH = import.meta.env.PROD ? '/douyinlive/socket.io' : '/socket.io';
const STORAGE_KEY_CONNECTION = 'danmu_connection_settings';

export type PlatformType = 'mock' | 'bilibili' | 'douyin';

/** 服务端 → 客户端 事件载荷 */
interface ServerToClientEvents {
  danmu: (msg: { username: string; content: string; platform: string }) => void;
  status: (status: { platform: string; roomId: string; connected: boolean }) => void;
}

/** 客户端 → 服务端 事件载荷 */
interface ClientToServerEvents {
  join: (data: { platform: 'bilibili' | 'douyin'; roomId: string }) => void;
}

/** 从 localStorage 恢复上次的连接设置，损坏时回退默认值 */
function loadConnectionSettings(): { platform: PlatformType; roomId: string } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CONNECTION);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        platform: parsed.platform === 'bilibili' || parsed.platform === 'douyin' ? parsed.platform : 'mock',
        roomId: typeof parsed.roomId === 'string' ? parsed.roomId : '',
      };
    }
  } catch {
    // 忽略损坏数据
  }
  return { platform: 'mock', roomId: '' };
}

export function useDanmu() {
  // 连接设置初始化：从 localStorage 恢复上次的平台与房间号
  const [connectionSettings] = useState(loadConnectionSettings);
  const [danmus, setDanmus] = useState<Danmu[]>([]);
  const [platform, setPlatform] = useState<PlatformType>(connectionSettings.platform);
  const [roomId, setRoomId] = useState(connectionSettings.roomId);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterKeyword, setFilterKeyword] = useState('');
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const intervalRef = useRef<number | null>(null);

  const addDanmu = useCallback((danmu: Danmu) => {
    setDanmus(prev => {
      const updated = [...prev, danmu];
      if (updated.length > MAX_DANMU_COUNT) {
        return updated.slice(-MAX_DANMU_COUNT);
      }
      return updated;
    });
  }, []);

  const connect = useCallback(() => {
    // 先断开已有连接，防止重复连接
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    if (platform === 'mock') {
      setConnected(true);
      setError(null);
      intervalRef.current = window.setInterval(() => {
        const newDanmu = generateRandomDanmu();
        addDanmu(newDanmu);
      }, 800 + Math.random() * 1200);
    } else {
      if (!roomId.trim()) return;

      socketRef.current = io(SOCKET_URL, { path: SOCKET_PATH }) as Socket<ServerToClientEvents, ClientToServerEvents>;

      socketRef.current.on('connect', () => {
        setError(null);
        socketRef.current?.emit('join', { platform, roomId: roomId.trim() });
      });

      socketRef.current.on('connect_error', () => {
        setConnected(false);
        setError('无法连接后端服务器，请确认服务已启动');
      });

      socketRef.current.on('danmu', (msg: { username: string; content: string; platform: string }) => {
        const newDanmu: Danmu = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          username: msg.username,
          content: msg.content,
          timestamp: Date.now(),
          color: platform === 'bilibili' ? '#FF6B6B' : '#4ECDC4'
        };
        addDanmu(newDanmu);
      });

      socketRef.current.on('status', (status: { connected: boolean }) => {
        setConnected(status.connected);
        if (status.connected) {
          setError(null);
        } else if (platform === 'douyin') {
          setError('抖音连接失败，请检查直播间ID或代理服务是否正常');
        } else {
          setError('连接失败，请检查直播间ID是否正确');
        }
      });
    }
  }, [platform, roomId, addDanmu]);

  const disconnect = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setConnected(false);
    setError(null);
  }, []);

  const sendReply = useCallback((content: string) => {
    if (!content.trim()) return;

    const replyDanmu = generateReplyDanmu(content);
    addDanmu(replyDanmu);
  }, [addDanmu]);

  const clearDanmus = useCallback(() => {
    setDanmus([]);
  }, []);

  const filteredDanmus = danmus.filter(danmu => {
    if (filterKeyword === '') return true;
    const kw = filterKeyword.toLowerCase();
    return danmu.content.toLowerCase().includes(kw) ||
      danmu.username.toLowerCase().includes(kw);
  });

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  useEffect(() => {
    if (platform !== 'mock') {
      disconnect();
    }
  }, [platform, disconnect]);

  // 持久化连接设置，刷新后恢复
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CONNECTION, JSON.stringify({ platform, roomId }));
  }, [platform, roomId]);

  return {
    danmus: filteredDanmus,
    allDanmus: danmus,
    platform,
    setPlatform,
    roomId,
    setRoomId,
    connected,
    error,
    filterKeyword,
    setFilterKeyword,
    connect,
    disconnect,
    sendReply,
    clearDanmus
  };
}
