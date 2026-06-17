import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { BilibiliLive } from './bilibili';
import { DouyinLive } from './douyin';
import type { DanmuMessage } from './bilibili';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

const PORT = process.env.PORT || 3001;

interface LiveSession {
  platform: 'bilibili' | 'douyin';
  roomId: string;
  bilibili?: BilibiliLive;
  douyin?: DouyinLive;
}

const sessions = new Map<string, LiveSession>();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join', async (data: { platform: 'bilibili' | 'douyin'; roomId: string }) => {
    const { platform, roomId } = data;
    
    const sessionKey = `${platform}-${roomId}`;
    let session = sessions.get(sessionKey);

    if (!session) {
      session = { platform, roomId };
      
      if (platform === 'bilibili') {
        session.bilibili = new BilibiliLive(roomId);
        session.bilibili.setCallbacks(
          (msg: DanmuMessage) => {
            io.emit('danmu', msg);
          },
          (connected: boolean) => {
            io.emit('status', { platform, roomId, connected });
          }
        );
        session.bilibili.connect();
      } else {
        session.douyin = new DouyinLive(roomId);
        session.douyin.setCallbacks(
          (msg: DanmuMessage) => {
            io.emit('danmu', msg);
          },
          (connected: boolean) => {
            io.emit('status', { platform, roomId, connected });
          }
        );
        await session.douyin.connect();
      }
      
      sessions.set(sessionKey, session);
    }

    socket.join(sessionKey);
    socket.emit('status', { 
      platform, 
      roomId, 
      connected: platform === 'bilibili' 
        ? session.bilibili?.isConnected() 
        : session.douyin?.isConnected() 
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/sessions', (req, res) => {
  const sessionList = Array.from(sessions.entries()).map(([key, session]) => ({
    key,
    platform: session.platform,
    roomId: session.roomId,
    connected: session.platform === 'bilibili' 
      ? session.bilibili?.isConnected() 
      : session.douyin?.isConnected()
  }));
  res.json(sessionList);
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
