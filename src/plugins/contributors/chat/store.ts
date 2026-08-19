import { create } from 'zustand'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatStore {
  messages: ChatMessage[]
  pending: boolean
  pushMessage: (item: ChatMessage) => void
  setPending: (pending: boolean) => void
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  pending: false,
  pushMessage: (item) => set((state) => ({ messages: [...state.messages, item] })),
  setPending: (pending) => set({ pending }),
}))
