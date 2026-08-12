import { useRef, useEffect, useState } from 'react';
import type { Danmu } from '../types/danmu';
import { DanmuItem } from './DanmuItem';
import { MessageSquare, ChevronDown } from 'lucide-react';

interface DanmuListProps {
  danmus: Danmu[];
}

/** 距底部超过该值视为"用户上翻" */
const SCROLLED_UP_THRESHOLD = 40;

export function DanmuList({ danmus }: DanmuListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const isUserScrolling = useRef(false);
  const scrollTimeout = useRef<number | null>(null);
  const [scrolledUp, setScrolledUp] = useState(false);

  useEffect(() => {
    return () => {
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (!list || isUserScrolling.current) return;

    list.scrollTop = list.scrollHeight;
    setScrolledUp(false);
  }, [danmus]);

  const handleScroll = () => {
    isUserScrolling.current = true;
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }
    scrollTimeout.current = window.setTimeout(() => {
      isUserScrolling.current = false;
    }, 1500);

    const list = listRef.current;
    if (list) {
      const distFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
      setScrolledUp(distFromBottom > SCROLLED_UP_THRESHOLD);
    }
  };

  const jumpToBottom = () => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
    isUserScrolling.current = false;
    setScrolledUp(false);
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
    <div className="relative flex-1">
      <div
        ref={listRef}
        onScroll={handleScroll}
        data-testid="danmu-list"
        className="h-full overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin scrollbar-thumb-purple-500/30 scrollbar-track-transparent"
      >
        {danmus.map((danmu, index) => (
          <DanmuItem key={danmu.id} danmu={danmu} index={index} />
        ))}
      </div>

      {scrolledUp && (
        <button
          onClick={jumpToBottom}
          className="absolute bottom-4 right-4 flex items-center gap-1.5 px-3 py-2 bg-purple-600/90 hover:bg-purple-500 text-white text-sm font-medium rounded-full shadow-lg transition-colors"
        >
          <ChevronDown className="w-4 h-4" />
          回到底部
        </button>
      )}
    </div>
  );
}
