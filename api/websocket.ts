import { WebSocketServer, WebSocket } from 'ws'
import type { Room, User, Danmu, Gift, ClientMessage, ServerMessage, SerializedRoom } from '../shared/types.js'
import { GIFTS } from '../shared/types.js'

// 创建单例房间
const room: Room = {
  id: 'default-room',
  title: '默认直播间',
  hostUsername: '主播小明',
  danmus: [],
  users: [],
  bannedUsers: new Map(),
  likeCount: 0,
  giftHistory: [],
}

// 客户端连接映射
const clients = new Map<WebSocket, { username: string; isHost: boolean }>()

// 生成唯一ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

// 序列化房间信息（用于发送给客户端）
function serializeRoom(): SerializedRoom {
  return {
    id: room.id,
    title: room.title,
    hostUsername: room.hostUsername,
    danmus: room.danmus.slice(-100), // 只发送最近100条弹幕
    likeCount: room.likeCount,
  }
}

// 广播消息给所有客户端
function broadcast(message: ServerMessage, excludeWs?: WebSocket) {
  const data = JSON.stringify(message)
  clients.forEach((_, ws) => {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(data)
    }
  })
}

// 检查用户是否被禁言
function isUserBanned(username: string): boolean {
  const bannedUntil = room.bannedUsers.get(username)
  if (!bannedUntil) return false
  if (Date.now() > bannedUntil) {
    room.bannedUsers.delete(username)
    return false
  }
  return true
}

// 获取禁言剩余时间
function getBanRemaining(username: string): number {
  const bannedUntil = room.bannedUsers.get(username)
  if (!bannedUntil) return 0
  return Math.max(0, bannedUntil - Date.now())
}

// 处理客户端消息
function handleMessage(ws: WebSocket, message: ClientMessage) {
  const client = clients.get(ws)
  if (!client) return

  switch (message.type) {
    case 'join': {
      // 用户加入
      client.username = message.username
      client.isHost = message.isHost

      // 添加到用户列表
      const existingUser = room.users.find(u => u.username === message.username)
      if (!existingUser) {
        room.users.push({
          username: message.username,
          isHost: message.isHost,
          isManager: false,
          joinedAt: Date.now(),
        })
      }

      // 发送初始化数据
      ws.send(JSON.stringify({
        type: 'init',
        room: serializeRoom(),
        users: room.users.map(u => u.username),
      } as ServerMessage))

      // 广播用户列表更新
      broadcast({
        type: 'userList',
        users: room.users.map(u => u.username),
      })
      break
    }

    case 'danmu': {
      // 发送弹幕
      if (isUserBanned(client.username)) {
        ws.send(JSON.stringify({
          type: 'error',
          message: '您已被禁言',
        } as ServerMessage))
        return
      }

      const danmu: Danmu = {
        id: generateId(),
        username: client.username,
        content: message.content,
        color: message.color,
        timestamp: Date.now(),
      }

      room.danmus.push(danmu)
      if (room.danmus.length > 500) {
        room.danmus.shift()
      }

      broadcast({
        type: 'danmu',
        username: danmu.username,
        content: danmu.content,
        color: danmu.color,
        id: danmu.id,
      })
      break
    }

    case 'like': {
      // 点赞
      room.likeCount++
      broadcast({
        type: 'like',
        count: room.likeCount,
      })
      break
    }

    case 'gift': {
      // 送礼物
      const giftConfig = GIFTS[message.giftId - 1]
      if (!giftConfig) return

      const gift: Gift = {
        id: generateId(),
        username: client.username,
        giftName: giftConfig.name,
        count: message.count,
        timestamp: Date.now(),
      }

      room.giftHistory.push(gift)
      if (room.giftHistory.length > 100) {
        room.giftHistory.shift()
      }

      broadcast({
        type: 'gift',
        username: gift.username,
        giftName: gift.giftName,
        count: gift.count,
      })
      break
    }

    case 'setManager': {
      // 设置房管
      if (!client.isHost) {
        ws.send(JSON.stringify({
          type: 'error',
          message: '只有主播可以设置房管',
        } as ServerMessage))
        return
      }

      const user = room.users.find(u => u.username === message.username)
      if (user) {
        user.isManager = message.isManager
        broadcast({
          type: 'managerSet',
          username: message.username,
          isManager: message.isManager,
        })
      }
      break
    }

    case 'ban': {
      // 禁言用户
      if (!client.isHost) {
        const user = room.users.find(u => u.username === client.username)
        if (!user?.isManager) {
          ws.send(JSON.stringify({
            type: 'error',
            message: '只有主播和房管可以禁言用户',
          } as ServerMessage))
          return
        }
      }

      const bannedUntil = Date.now() + message.duration * 1000
      room.bannedUsers.set(message.username, bannedUntil)

      broadcast({
        type: 'banned',
        username: message.username,
        until: bannedUntil,
      })
      break
    }

    case 'unban': {
      // 解除禁言
      if (!client.isHost) {
        ws.send(JSON.stringify({
          type: 'error',
          message: '只有主播可以解除禁言',
        } as ServerMessage))
        return
      }

      room.bannedUsers.delete(message.username)

      broadcast({
        type: 'unbanned',
        username: message.username,
      })
      break
    }

    case 'deleteDanmu': {
      // 删除弹幕
      const danmuIndex = room.danmus.findIndex(d => d.id === message.danmuId)
      if (danmuIndex !== -1) {
        room.danmus.splice(danmuIndex, 1)
        broadcast({
          type: 'danmuDeleted',
          danmuId: message.danmuId,
        })
      }
      break
    }
  }
}

// 创建并初始化 WebSocket 服务器
export function initWebSocket(server: any) {
  const wss = new WebSocketServer({ server })

  wss.on('connection', (ws: WebSocket) => {
    console.log('新的 WebSocket 连接')

    // 初始化客户端信息
    clients.set(ws, { username: '', isHost: false })

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as ClientMessage
        handleMessage(ws, message)
      } catch (error) {
        console.error('解析消息失败:', error)
        ws.send(JSON.stringify({
          type: 'error',
          message: '消息格式错误',
        } as ServerMessage))
      }
    })

    ws.on('close', () => {
      const client = clients.get(ws)
      clients.delete(ws)
      console.log(`用户 ${client?.username || '未知'} 断开连接`)

      // 更新用户列表
      if (client?.username) {
        const userIndex = room.users.findIndex(u => u.username === client.username)
        if (userIndex !== -1) {
          room.users.splice(userIndex, 1)
        }
        broadcast({
          type: 'userList',
          users: room.users.map(u => u.username),
        })
      }
    })

    ws.on('error', (error) => {
      console.error('WebSocket 错误:', error)
    })
  })

  return wss
}

// 导出房间信息（用于API）
export function getRoomInfo() {
  return {
    id: room.id,
    title: room.title,
    hostUsername: room.hostUsername,
    userCount: room.users.length,
    likeCount: room.likeCount,
    giftHistory: room.giftHistory.slice(-10),
  }
}
