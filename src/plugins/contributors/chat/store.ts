interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const listeners = new Set<() => void>()
let messages: ChatMessage[] = []
let pending = false

export function emit() {
  for (const fn of listeners) fn()
}

export function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getMessages() {
  return messages
}

export function getPending() {
  return pending
}

export function setPending(value: boolean) {
  pending = value
}

export function pushMessage(item: ChatMessage) {
  messages = [...messages, item]
}
