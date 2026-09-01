import type { ChatNode } from './session-project.ts'

export type ChatOutlineFilter = 'user' | 'all'

export type ChatOutlineItem = {
  id: string
  text: string
  robot: boolean
}

const OPEN_KEY = 'cordis.chatOutline.open'
const FILTER_KEY = 'cordis.chatOutline.filter'

const outlineListeners = new Set<() => void>()

function emitOutlineChange() {
  for (const fn of outlineListeners) fn()
}

export function subscribeChatOutline(fn: () => void) {
  outlineListeners.add(fn)
  return () => {
    outlineListeners.delete(fn)
  }
}

export function getChatOutlineOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) === '1'
  } catch {
    return false
  }
}

export function setChatOutlineOpen(open: boolean) {
  try {
    localStorage.setItem(OPEN_KEY, open ? '1' : '0')
  } catch {
    /* ignore */
  }
  emitOutlineChange()
}

export function getChatOutlineFilter(): ChatOutlineFilter {
  try {
    return localStorage.getItem(FILTER_KEY) === 'all' ? 'all' : 'user'
  } catch {
    return 'user'
  }
}

export function setChatOutlineFilter(filter: ChatOutlineFilter) {
  try {
    localStorage.setItem(FILTER_KEY, filter)
  } catch {
    /* ignore */
  }
  emitOutlineChange()
}

export function outlinePreview(text: string, max = 48): string {
  const one = text.replace(/\s+/g, ' ').trim()
  if (!one) return '空消息'
  return one.length > max ? `${one.slice(0, max)}…` : one
}

export function isHumanUserNode(node: Extract<ChatNode, { kind: 'user' }>): boolean {
  return !node.sender || node.sender.type === 'user'
}

export function deriveChatOutline(nodes: ChatNode[], filter: ChatOutlineFilter): ChatOutlineItem[] {
  const items: ChatOutlineItem[] = []
  for (const node of nodes) {
    if (node.kind !== 'user') continue
    const robot = !isHumanUserNode(node)
    if (filter === 'user' && robot) continue
    items.push({ id: node.id, text: outlinePreview(node.text), robot })
  }
  return items
}

export function requestChatOutlineGo(nodeId: string) {
  window.dispatchEvent(new CustomEvent('biu:chat-outline-go', { detail: { nodeId } }))
}

export function nodeIdFromOutlineEvent(event: Event): string | undefined {
  const detail = (event as CustomEvent<{ nodeId?: unknown }>).detail
  return typeof detail?.nodeId === 'string' && detail.nodeId ? detail.nodeId : undefined
}
