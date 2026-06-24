import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Danmu } from '../types/danmu';
import { generateRandomDanmu, generateReplyDanmu } from '../utils/mockDanmu';

const MAX_DANMU_COUNT = 50;
const SOCKET_URL = 'http://localhost:3001';

export type PlatformType = 'mock' | 'bilibili' | 'douyin';

export function useDanmu() {
  const [danmus, setDanmus] = useState<Danmu[]>([]);
  const [platform, setPlatform] = useState<PlatformType>('mock');
  const [roomId, setRoomId] = useState('');
  const [connected, setConnected] = useState(false);
  const [filterKeyword, setFilterKeyword] = useState('');
  const socketRef = useRef<Socket | null>(null);
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
    if (platform === 'mock') {
      setConnected(true);
      intervalRef.current = window.setInterval(() => {
        const newDanmu = generateRandomDanmu();
        addDanmu(newDanmu);
      }, 800 + Math.random() * 1200);
    } else {
      if (!roomId.trim()) return;

      socketRef.current = io(SOCKET_URL);

      socketRef.current.on('connect', () => {
        socketRef.current?.emit('join', { platform, roomId: roomId.trim() });
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
  }, []);

  const sendReply = useCallback((content: string) => {
    if (!content.trim()) return;

    const replyDanmu = generateReplyDanmu(content);
    addDanmu(replyDanmu);
  }, [addDanmu]);

  const clearDanmus = useCallback(() => {
    setDanmus([]);
  }, []);

  const filteredDanmus = danmus.filter(danmu =>
    filterKeyword === '' ||
    danmu.content.includes(filterKeyword) ||
    danmu.username.includes(filterKeyword)
  );

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

  return {
    danmus: filteredDanmus,
    allDanmus: danmus,
    platform,
    setPlatform,
    roomId,
    setRoomId,
    connected,
    filterKeyword,
    setFilterKeyword,
    connect,
    disconnect,
    sendReply,
    clearDanmus
  };
}
