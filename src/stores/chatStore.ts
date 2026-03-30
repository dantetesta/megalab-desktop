import { create } from 'zustand'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'error'
  content: string
  timestamp: string // ISO string for serialization
  configJson?: string | null
  saveGames?: { numbers: number[], game_type: string, strategy_label: string }[]
}

export interface Chat {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: string
}

interface ChatStore {
  chats: Chat[]
  activeChatId: string | null

  createChat: () => string // returns new chat id
  deleteChat: (id: string) => void
  setActiveChat: (id: string) => void
  addMessage: (chatId: string, message: ChatMessage) => void
  getActiveChat: () => Chat | null
  updateChatTitle: (chatId: string, title: string) => void
}

const MAX_CHATS = 20

// Load from localStorage
const loadChats = (): Chat[] => {
  try {
    const raw = localStorage.getItem('lotolab-chats')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

const saveChats = (chats: Chat[]) => {
  localStorage.setItem('lotolab-chats', JSON.stringify(chats))
}

export const useChatStore = create<ChatStore>((set, get) => ({
  chats: loadChats(),
  activeChatId: null,

  createChat: () => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2)
    const chat: Chat = { id, title: 'Nova conversa', messages: [], createdAt: new Date().toISOString() }
    const chats = [chat, ...get().chats].slice(0, MAX_CHATS)
    set({ chats, activeChatId: id })
    saveChats(chats)
    return id
  },

  deleteChat: (id) => {
    const chats = get().chats.filter(c => c.id !== id)
    const activeChatId = get().activeChatId === id ? (chats[0]?.id || null) : get().activeChatId
    set({ chats, activeChatId })
    saveChats(chats)
  },

  setActiveChat: (id) => set({ activeChatId: id }),

  addMessage: (chatId, message) => {
    const chats = get().chats.map(c => {
      if (c.id !== chatId) return c
      const messages = [...c.messages, message]
      // Auto-title from first user message
      let title = c.title
      if (title === 'Nova conversa' && message.role === 'user') {
        title = message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '')
      }
      return { ...c, messages, title }
    })
    set({ chats })
    saveChats(chats)
  },

  getActiveChat: () => {
    const { chats, activeChatId } = get()
    return chats.find(c => c.id === activeChatId) || null
  },

  updateChatTitle: (chatId, title) => {
    const chats = get().chats.map(c => c.id === chatId ? { ...c, title } : c)
    set({ chats })
    saveChats(chats)
  },
}))
