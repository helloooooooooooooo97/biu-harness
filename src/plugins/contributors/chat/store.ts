import { create } from 'zustand'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatStore {
  sessionId: string | null
  messages: ChatMessage[]
  pending: boolean
  setSessionId: (sessionId: string) => void
  pushMessage: (item: ChatMessage) => void
  setPending: (pending: boolean) => void
}

export const useChatStore = create<ChatStore>((set) => ({
  sessionId: null,
  messages: [],
  pending: false,
  setSessionId: (sessionId) => set({ sessionId }),
  pushMessage: (item) => set((state) => ({ messages: [...state.messages, item] })),
  setPending: (pending) => set({ pending }),
}))
