import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { BilibiliLive } from './bilibili';
import { DouyinLive } from './douyin';
import type { DanmuClientEvents, DanmuMessage, DanmuServerEvents } from './types';

const app = express();
const server = createServer(app);
const io = new Server<DanmuClientEvents, DanmuServerEvents>(server, {
  cors: {
    origin: "*"
  }
});

const PORT = process.env.PORT || 3001;

// 托管前端静态文件
const frontendDist = path.resolve(__dirname, '../../dist');
app.use(express.static(frontendDist));

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
        try {
          await session.douyin.connect();
        } catch (err) {
          console.error('Douyin connect failed:', err);
          sessions.delete(sessionKey);
          socket.emit('status', { platform, roomId, connected: false });
          return;
        }
      }
      
      sessions.set(sessionKey, session);
    }

    socket.join(sessionKey);
    socket.emit('status', {
      platform,
      roomId,
      connected: platform === 'bilibili'
        ? session.bilibili?.isConnected() ?? false
        : session.douyin?.isConnected() ?? false
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    // 检查每个 session，如果没有客户端在对应房间则清理
    for (const [key, session] of sessions) {
      const room = io.sockets.adapter.rooms.get(key);
      if (!room || room.size === 0) {
        session.bilibili?.disconnect();
        session.douyin?.disconnect();
        sessions.delete(key);
      }
    }
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

// SPA fallback：须放在所有 API 路由之后，否则会拦截 /api/* 请求。
// 未匹配的 API/socket 路径返回 404，避免请求悬挂。
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }
  res.sendFile(path.join(frontendDist, 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
