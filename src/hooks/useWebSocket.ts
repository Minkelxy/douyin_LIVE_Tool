import { useEffect, useRef, useCallback } from 'react'
import { useRoomStore } from '@/store/roomStore'
import type { ClientMessage, ServerMessage, SerializedRoom } from '../../shared/types'

const WS_URL = `ws://${window.location.hostname}:3001`

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)

  const {
    setConnected,
    setRoomInfo,
    setUsers,
    addDanmu,
    removeDanmu,
    setLikeCount,
    addGift,
    setBanned,
    setUnbanned,
    setIsManager,
    username,
    isHost,
  } = useRoomStore()

  const sendMessage = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    }
  }, [])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('WebSocket 已连接')
      setConnected(true)

      // 发送加入消息
      const joinMessage: ClientMessage = {
        type: 'join',
        username,
        isHost,
      }
      ws.send(JSON.stringify(joinMessage))
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as ServerMessage
        handleMessage(message)
      } catch (error) {
        console.error('解析消息失败:', error)
      }
    }

    ws.onclose = () => {
      console.log('WebSocket 已断开')
      setConnected(false)

      // 尝试重连
      reconnectTimeoutRef.current = window.setTimeout(() => {
        console.log('正在重连...')
        connect()
      }, 3000)
    }

    ws.onerror = (error) => {
      console.error('WebSocket 错误:', error)
    }
  }, [username, isHost, setConnected])

  const handleMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case 'init': {
        const room = message.room as SerializedRoom
        setRoomInfo({
          roomId: room.id,
          title: room.title,
          hostUsername: room.hostUsername,
          likeCount: room.likeCount,
        })
        setUsers(message.users)
        // 设置初始弹幕
        message.room.danmus.forEach(d => addDanmu(d))
        break
      }
      case 'danmu':
        addDanmu({
          id: message.id,
          username: message.username,
          content: message.content,
          color: message.color,
          timestamp: Date.now(),
        })
        break
      case 'danmuDeleted':
        removeDanmu(message.danmuId)
        break
      case 'like':
        setLikeCount(message.count)
        break
      case 'gift':
        addGift({
          id: Date.now().toString(),
          username: message.username,
          giftName: message.giftName,
          count: message.count,
          timestamp: Date.now(),
        })
        break
      case 'userList':
        setUsers(message.users)
        break
      case 'banned':
        setBanned(message.username, message.until)
        break
      case 'unbanned':
        setUnbanned(message.username)
        break
      case 'managerSet':
        if (message.username === username) {
          setIsManager(message.isManager)
        }
        break
      case 'error':
        console.error('服务器错误:', message.message)
        break
    }
  }, [addDanmu, removeDanmu, setLikeCount, addGift, setUsers, setBanned, setUnbanned, setRoomInfo, setIsManager, username])

  useEffect(() => {
    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [connect])

  return { sendMessage }
}
