import { Header } from './components/Header';
import { DanmuList } from './components/DanmuList';
import { ReplyInput } from './components/ReplyInput';
import { useDanmu } from './hooks/useDanmu';

export default function App() {
  const {
    danmus,
    connection,
    filterKeyword,
    setFilterKeyword,
    connect,
    disconnect,
    sendReply,
    clearDanmus
  } = useDanmu();

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-950">
      <Header
        connection={connection}
        filterKeyword={filterKeyword}
        onFilterChange={setFilterKeyword}
        onConnect={connect}
        onDisconnect={disconnect}
        onClear={clearDanmus}
      />

      <DanmuList danmus={danmus} />

      <ReplyInput
        onSend={sendReply}
        disabled={connection.status !== 'connected'}
      />
    </div>
  );
}
