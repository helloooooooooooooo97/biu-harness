import { memo, useMemo, useSyncExternalStore } from 'react'
import { OutlineNav } from '@biu/public-ui'
import {
  bindSessionView,
  deriveChatOutline,
  getChatOutlineFilter,
  requestChatOutlineGo,
  subscribeChatOutline,
  type ChatOutlineFilter,
  type SessionViewService,
} from '@biu/web-session-view'

export const ChatMessageOutline = memo(function ChatMessageOutline({
  useSessionView,
}: {
  useSessionView: ReturnType<typeof bindSessionView>
  sessionView?: SessionViewService
}) {
  const nodes = useSessionView((state) => state.nodes)
  const filter = useSyncExternalStore(subscribeChatOutline, getChatOutlineFilter, (): ChatOutlineFilter => 'user')
  const items = useMemo(() => deriveChatOutline(nodes, filter), [nodes, filter])
  return <OutlineNav items={items} onSelect={requestChatOutlineGo} />
})
