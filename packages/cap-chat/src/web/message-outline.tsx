import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  bindSessionView,
  deriveChatOutline,
  getChatOutlineFilter,
  requestChatOutlineGo,
  subscribeChatOutline,
  type ChatOutlineFilter,
  type SessionViewService,
} from '@biu/web-session-view'

function escapeId(id: string) {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(id) : id
}

export const ChatMessageOutline = memo(function ChatMessageOutline({
  useSessionView,
}: {
  useSessionView: ReturnType<typeof bindSessionView>
  sessionView?: SessionViewService
}) {
  const nodes = useSessionView((state) => state.nodes)
  const rootRef = useRef<HTMLElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const leaveTimer = useRef(0)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const filter = useSyncExternalStore(subscribeChatOutline, getChatOutlineFilter, (): ChatOutlineFilter => 'user')
  const items = useMemo(() => deriveChatOutline(nodes, filter), [nodes, filter])

  useEffect(() => () => window.clearTimeout(leaveTimer.current), [])

  function keepOpen() {
    window.clearTimeout(leaveTimer.current)
  }

  function scheduleClose() {
    window.clearTimeout(leaveTimer.current)
    leaveTimer.current = window.setTimeout(() => {
      setHoverId(null)
    }, 140)
  }

  function hoverTick(id: string) {
    keepOpen()
    setHoverId(id)
  }

  function hoverMenuItem(id: string) {
    keepOpen()
    setHoverId(id)
  }

  useLayoutEffect(() => {
    if (!hoverId) return
    const rail = railRef.current
    const panel = panelRef.current
    const tick = rail?.querySelector<HTMLElement>(`[data-outline-tick="${escapeId(hoverId)}"]`)
    const row = panel?.querySelector<HTMLElement>(`[data-outline-row="${escapeId(hoverId)}"]`)
    tick?.scrollIntoView({ block: 'nearest' })
    row?.scrollIntoView({ block: 'nearest' })
  }, [hoverId, items.length])

  if (!items.length) return null

  return (
    <aside
      className="chat-outline"
      aria-label="消息大纲"
      ref={rootRef}
      data-testid="chat-outline"
      onMouseEnter={keepOpen}
      onMouseLeave={scheduleClose}
    >
      <div className="chat-outline-rail" ref={railRef} data-testid="chat-outline-rail">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`chat-outline-tick${item.robot ? ' is-robot' : ''}${hoverId === item.id ? ' is-active' : ''}`}
            title={item.text}
            aria-label={item.text}
            data-outline-tick={item.id}
            data-testid={`chat-outline-tick-${item.id}`}
            onMouseEnter={() => hoverTick(item.id)}
            onFocus={() => hoverTick(item.id)}
            onClick={() => requestChatOutlineGo(item.id)}
          />
        ))}
      </div>
      {hoverId ? (
        <nav className="chat-outline-panel" ref={panelRef} data-testid="chat-outline-panel">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`chat-outline-item${item.robot ? ' is-robot' : ''}${hoverId === item.id ? ' is-active' : ''}`}
              title={item.text}
              data-outline-row={item.id}
              data-testid={`chat-outline-item-${item.id}`}
              onMouseEnter={() => hoverMenuItem(item.id)}
              onClick={() => requestChatOutlineGo(item.id)}
            >
              <span className="chat-outline-label">{item.text}</span>
            </button>
          ))}
        </nav>
      ) : null}
    </aside>
  )
})
