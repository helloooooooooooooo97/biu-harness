import { memo, useEffect, useRef, useState } from 'react'
import { bindSessionView, type SessionViewService } from '@biu/web-session-view'
import { BrandCornerMascot } from '@biu/web-mascot'
import { ChatSidebar } from './chat-sidebar.tsx'

export const ChatSessionTitle = memo(function ChatSessionTitle({
  useSessionView,
  sessionView,
}: {
  useSessionView: ReturnType<typeof bindSessionView>
  sessionView: SessionViewService
}) {
  const sessionId = useSessionView((state) => state.sessionId)
  const sessions = useSessionView((state) => state.sessions)
  const title = useSessionView((state) => {
    const id = state.sessionId
    if (!id) return ''
    return state.sessions.find((item) => item.id === id)?.title ?? ''
  })
  const [draft, setDraft] = useState(title)
  const focusedRef = useRef(false)

  useEffect(() => {
    if (!focusedRef.current) setDraft(title)
  }, [sessionId, title])

  if (!sessionId) return null

  return (
    <div className="chat-view-session-title-wrap">
      <input
        className="chat-view-session-title"
        value={draft}
        placeholder="未命名会话"
        aria-label="会话名称"
        data-testid="chat-session-title"
        title={draft || title || '会话名称'}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={() => {
          focusedRef.current = true
        }}
        onBlur={() => {
          focusedRef.current = false
          const next = draft.trim()
          if (next === title.trim()) {
            setDraft(title)
            return
          }
          void sessionView.setSessionTitle(sessionId, next).catch(() => {
            setDraft(title)
          })
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setDraft(title)
            ;(event.target as HTMLInputElement).blur()
            return
          }
          if (event.key !== 'Enter') return
          event.preventDefault()
          ;(event.target as HTMLInputElement).blur()
        }}
      />
      <BrandCornerMascot
        agents={sessions}
        activeId={sessionId}
        size={22}
        menu={(close) => (
          <ChatSidebar
            variant="popover"
            visible
            routeSessionId={sessionId}
            useSessionView={useSessionView}
            sessionView={sessionView}
            onActivate={close}
          />
        )}
      />
    </div>
  )
})
