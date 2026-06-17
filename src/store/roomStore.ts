import { create } from 'zustand'

export interface Danmu {
  id: string
  username: string
  content: string
  color: string
  timestamp: number
}

export interface Gift {
  id: string
  username: string
  giftName: string
  count: number
  timestamp: number
}

interface RoomState {
  // 连接状态
  isConnected: boolean
  username: string
  isHost: boolean
  isManager: boolean

  // 房间信息
  roomId: string
  title: string
  hostUsername: string
  likeCount: number

  // 用户列表
  users: string[]

  // 弹幕
  danmus: Danmu[]
  visibleDanmus: Danmu[]

  // 礼物记录
  giftHistory: Gift[]

  // 禁言列表
  bannedUsers: Map<string, number>

  // 操作
  setConnected: (connected: boolean) => void
  setUsername: (username: string) => void
  setIsHost: (isHost: boolean) => void
  setIsManager: (isManager: boolean) => void
  setRoomInfo: (info: { roomId: string; title: string; hostUsername: string; likeCount: number }) => void
  setUsers: (users: string[]) => void
  addDanmu: (danmu: Danmu) => void
  removeDanmu: (danmuId: string) => void
  setLikeCount: (count: number) => void
  addGift: (gift: Gift) => void
  setBanned: (username: string, until: number) => void
  setUnbanned: (username: string) => void
  reset: () => void
}

const initialState = {
  isConnected: false,
  username: '',
  isHost: false,
  isManager: false,
  roomId: '',
  title: '',
  hostUsername: '',
  likeCount: 0,
  users: [],
  danmus: [],
  visibleDanmus: [],
  giftHistory: [],
  bannedUsers: new Map(),
}

export const useRoomStore = create<RoomState>((set, get) => ({
  ...initialState,

  setConnected: (connected) => set({ isConnected: connected }),

  setUsername: (username) => set({ username }),

  setIsHost: (isHost) => set({ isHost }),

  setIsManager: (isManager) => set({ isManager }),

  setRoomInfo: (info) => set({
    roomId: info.roomId,
    title: info.title,
    hostUsername: info.hostUsername,
    likeCount: info.likeCount,
  }),

  setUsers: (users) => set({ users }),

  addDanmu: (danmu) => {
    const { danmus } = get()
    const newDanmus = [...danmus, danmu]
    // 保持最多200条弹幕在列表中
    if (newDanmus.length > 200) {
      newDanmus.shift()
    }
    set({ danmus: newDanmus })

    // 添加到可见弹幕用于显示
    setTimeout(() => {
      set((state) => ({
        visibleDanmus: state.visibleDanmus.filter(d => d.id !== danmu.id)
      }))
    }, 8000)

    set((state) => ({
      visibleDanmus: [...state.visibleDanmus, danmu]
    }))
  },

  removeDanmu: (danmuId) => set((state) => ({
    danmus: state.danmus.filter(d => d.id !== danmuId),
    visibleDanmus: state.visibleDanmus.filter(d => d.id !== danmuId),
  })),

  setLikeCount: (count) => set({ likeCount: count }),

  addGift: (gift) => {
    const { giftHistory } = get()
    const newHistory = [...giftHistory, gift]
    if (newHistory.length > 100) {
      newHistory.shift()
    }
    set({ giftHistory: newHistory })
  },

  setBanned: (username, until) => {
    const { bannedUsers } = get()
    const newMap = new Map(bannedUsers)
    newMap.set(username, until)
    set({ bannedUsers: newMap })
  },

  setUnbanned: (username) => {
    const { bannedUsers } = get()
    const newMap = new Map(bannedUsers)
    newMap.delete(username)
    set({ bannedUsers: newMap })
  },

  reset: () => set(initialState),
}))
