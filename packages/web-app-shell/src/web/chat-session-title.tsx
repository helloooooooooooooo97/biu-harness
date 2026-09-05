import { memo, useEffect, useRef, useState } from 'react'
import { bindSessionView, type SessionViewService } from '@biu/web-session-view'
import { BrandCornerMascot } from '@biu/public-mascot'
import { listenOutsideDismiss } from '@biu/public-ui'
import { ChatSidebar } from './chat-sidebar.tsx'

export const ChatSessionTitle = memo(function ChatSessionTitle({
  useSessionView,
  sessionView,
  showMascot = true,
}: {
  useSessionView: ReturnType<typeof bindSessionView>
  sessionView: SessionViewService
  showMascot?: boolean
}) {
  const sessionId = useSessionView((state) => state.sessionId)
  const sessions = useSessionView((state) => state.sessions)
  const title = useSessionView((state) => {
    const id = state.sessionId
    if (!id) return ''
    return state.sessions.find((item) => item.id === id)?.title ?? ''
  })
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(title)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) setDraft(title)
  }, [sessionId, title, open])

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    inputRef.current?.select()
    return listenOutsideDismiss(() => setOpen(false), (target) => Boolean(wrapRef.current?.contains(target)))
  }, [open])

  function commit() {
    if (!sessionId) return
    const next = draft.trim()
    setOpen(false)
    if (next === title.trim()) {
      setDraft(title)
      return
    }
    void sessionView.setSessionTitle(sessionId, next).catch(() => {
      setDraft(title)
    })
  }

  if (!sessionId) return null

  return (
    <div className="chat-view-session-title-wrap" ref={wrapRef}>
      <button
        type="button"
        className="chat-view-session-title"
        aria-label="会话名称"
        aria-expanded={open}
        data-testid="chat-session-title"
        title={title || '会话名称'}
        onClick={() => setOpen((prev) => !prev)}
      >
        {title || '未命名会话'}
      </button>
      {open ? (
        <div className="chat-view-session-title-pop" data-testid="chat-session-title-pop">
          <input
            ref={inputRef}
            className="chat-view-session-title-input"
            value={draft}
            placeholder="未命名会话"
            aria-label="编辑会话名称"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setDraft(title)
                setOpen(false)
                return
              }
              if (event.key !== 'Enter') return
              event.preventDefault()
              commit()
            }}
          />
        </div>
      ) : null}
      {showMascot ? (
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
      ) : null}
    </div>
  )
})
