import { memo, useEffect, useRef, useState } from 'react'
import { bindSessionView, type SessionViewService } from '@biu/web-session-view'
import { HeadlessDismiss } from '@biu/public-ui'

export const ChatSessionTitle = memo(function ChatSessionTitle({
  useSessionView,
  sessionView,
}: {
  useSessionView: ReturnType<typeof bindSessionView>
  sessionView: SessionViewService
}) {
  const sessionId = useSessionView((state) => state.sessionId)
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
        <HeadlessDismiss onDismiss={() => setOpen(false)} insideRef={wrapRef}>
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
        </HeadlessDismiss>
      ) : null}
    </div>
  )
})
