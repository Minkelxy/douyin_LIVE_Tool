// 共享类型定义

export interface Danmu {
  id: string
  username: string
  content: string
  color: string
  timestamp: number
}

export interface User {
  username: string
  isHost: boolean
  isManager: boolean
  joinedAt: number
}

export interface Gift {
  id: string
  username: string
  giftName: string
  count: number
  timestamp: number
}

export interface Room {
  id: string
  title: string
  hostUsername: string
  danmus: Danmu[]
  users: User[]
  bannedUsers: Map<string, number> // username -> unbanned timestamp
  likeCount: number
  giftHistory: Gift[]
}

// 客户端发送给服务端的消息类型
export type ClientMessage =
  | { type: 'danmu'; content: string; color: string }
  | { type: 'gift'; giftId: number; count: number }
  | { type: 'like' }
  | { type: 'join'; username: string; isHost: boolean }
  | { type: 'setManager'; username: string; isManager: boolean }
  | { type: 'ban'; username: string; duration: number }
  | { type: 'unban'; username: string }
  | { type: 'deleteDanmu'; danmuId: string }

// 服务端发送给客户端的消息类型
export type ServerMessage =
  | { type: 'init'; room: SerializedRoom; users: string[] }
  | { type: 'danmu'; username: string; content: string; color: string; id: string }
  | { type: 'gift'; username: string; giftName: string; count: number }
  | { type: 'like'; count: number }
  | { type: 'userList'; users: string[] }
  | { type: 'banned'; username: string; until: number }
  | { type: 'unbanned'; username: string }
  | { type: 'danmuDeleted'; danmuId: string }
  | { type: 'error'; message: string }
  | { type: 'managerSet'; username: string; isManager: boolean }

// 序列化的房间类型（用于传输）
export interface SerializedRoom {
  id: string
  title: string
  hostUsername: string
  danmus: Danmu[]
  likeCount: number
}

// 礼物配置
export const GIFTS = [
  { id: 1, name: '鲜花', price: 10 },
  { id: 2, name: '蛋糕', price: 50 },
  { id: 3, name: '火箭', price: 100 },
  { id: 4, name: '飞船', price: 500 },
]
