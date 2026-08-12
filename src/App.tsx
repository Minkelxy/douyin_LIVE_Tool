import { useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { DanmuList } from './components/DanmuList';
import { ReplyInput } from './components/ReplyInput';
import { InteractionSidebar } from './components/InteractionSidebar';
import { useDanmu } from './hooks/useDanmu';
import { useInteraction } from './hooks/useInteraction';

export default function App() {
  const {
    danmus,
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
  } = useDanmu();

  const interaction = useInteraction();

  const {
    processAutoReply,
    processLottery,
    processVote,
    processGiftReply
  } = interaction;

  // 处理弹幕自动回复和互动
  const processDanmuInteractions = useCallback((danmu: { id: string; username: string; content: string; timestamp: number }) => {
    const d = { ...danmu, color: '#8B5CF6', isReply: false };

    // 自动回复
    const autoReply = processAutoReply(d);
    if (autoReply) {
      sendReply(autoReply);
    }

    // 礼物感谢
    const giftReply = processGiftReply(d);
    if (giftReply) {
      sendReply(giftReply);
    }

    // 抽奖参与
    processLottery(d);

    // 投票参与
    processVote(d);
  }, [processAutoReply, processGiftReply, processLottery, processVote, sendReply]);

  // 监听弹幕变化
  useEffect(() => {
    if (danmus.length > 0) {
      const latestDanmu = danmus[danmus.length - 1];
      if (!latestDanmu.isReply) {
        processDanmuInteractions(latestDanmu);
      }
    }
  }, [danmus, processDanmuInteractions]);

  return (
    <div className="h-screen flex bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950">
      {/* 主内容区 */}
      <div className="flex-1 flex flex-col">
        <Header
          platform={platform}
          onPlatformChange={setPlatform}
          roomId={roomId}
          onRoomIdChange={setRoomId}
          connected={connected}
          error={error}
          filterKeyword={filterKeyword}
          onFilterChange={setFilterKeyword}
          onConnect={connect}
          onDisconnect={disconnect}
          onClear={clearDanmus}
        />

        <DanmuList danmus={danmus} />

        <ReplyInput
          onSend={sendReply}
          disabled={!connected}
        />
      </div>

      {/* 互动工具侧边栏 */}
      <InteractionSidebar
        // 自动回复
        autoReplyRules={interaction.autoReplyRules}
        onAddAutoReply={interaction.addAutoReplyRule}
        onRemoveAutoReply={interaction.removeAutoReplyRule}
        onUpdateAutoReply={interaction.updateAutoReplyRule}

        // 抽奖
        lotteryActive={interaction.lotteryActive}
        lotteryKeyword={interaction.lotteryKeyword}
        lotteryParticipantsCount={interaction.lotteryParticipants.length}
        lotteryResult={interaction.lotteryResult}
        onStartLottery={interaction.startLottery}
        onDrawLottery={interaction.drawLottery}
        onStopLottery={interaction.stopLottery}

        // 投票
        voteSession={interaction.voteSession}
        onStartVote={interaction.startVote}
        onEndVote={interaction.endVote}
        getVoteResults={interaction.getVoteResults}

        // 礼物感谢
        giftReplyRules={interaction.giftReplyRules}
        onAddGiftReply={interaction.addGiftReplyRule}
        onRemoveGiftReply={interaction.removeGiftReplyRule}
        onUpdateGiftReply={interaction.updateGiftReplyRule}
      />
    </div>
  );
}