import { useRef, useEffect } from 'react';
import type { Danmu } from '../types/danmu';
import { DanmuItem } from './DanmuItem';
import { MessageSquare } from 'lucide-react';

interface DanmuListProps {
  danmus: Danmu[];
}

export function DanmuList({ danmus }: DanmuListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const isUserScrolling = useRef(false);
  const scrollTimeout = useRef<number | null>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list || isUserScrolling.current) return;

    list.scrollTop = list.scrollHeight;
  }, [danmus]);

  const handleScroll = () => {
    isUserScrolling.current = true;
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }
    scrollTimeout.current = window.setTimeout(() => {
      isUserScrolling.current = false;
    }, 1500);
  };

  if (danmus.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-purple-400/50">
        <MessageSquare className="w-16 h-16 mb-4 opacity-30" />
        <p className="text-sm">暂无弹幕，点击连接开始</p>
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin scrollbar-thumb-purple-500/30 scrollbar-track-transparent"
    >
      {danmus.map((danmu, index) => (
        <DanmuItem key={danmu.id} danmu={danmu} index={index} />
      ))}
    </div>
  );
}
