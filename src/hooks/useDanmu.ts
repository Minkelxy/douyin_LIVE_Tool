import { useState, useEffect, useCallback, useRef } from 'react';
import type { Danmu, ConnectionState } from '../types/danmu';
import { generateRandomDanmu, generateReplyDanmu } from '../utils/mockDanmu';

const MAX_DANMU_COUNT = 50;

export function useDanmu() {
  const [danmus, setDanmus] = useState<Danmu[]>([]);
  const [connection, setConnection] = useState<ConnectionState>({
    status: 'disconnected',
    platform: '模拟数据'
  });
  const [filterKeyword, setFilterKeyword] = useState('');
  const intervalRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    setConnection(prev => ({ ...prev, status: 'connecting' }));

    setTimeout(() => {
      setConnection({ status: 'connected', platform: '模拟数据' });

      intervalRef.current = window.setInterval(() => {
        const newDanmu = generateRandomDanmu();
        setDanmus(prev => {
          const updated = [...prev, newDanmu];
          if (updated.length > MAX_DANMU_COUNT) {
            return updated.slice(-MAX_DANMU_COUNT);
          }
          return updated;
        });
      }, 800 + Math.random() * 1200);
    }, 1000);
  }, []);

  const disconnect = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setConnection(prev => ({ ...prev, status: 'disconnected' }));
  }, []);

  const sendReply = useCallback((content: string) => {
    if (!content.trim()) return;

    const replyDanmu = generateReplyDanmu(content);
    setDanmus(prev => [...prev, replyDanmu]);
  }, []);

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
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    danmus: filteredDanmus,
    allDanmus: danmus,
    connection,
    filterKeyword,
    setFilterKeyword,
    connect,
    disconnect,
    sendReply,
    clearDanmus
  };
}
