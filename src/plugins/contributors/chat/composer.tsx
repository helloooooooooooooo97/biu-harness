import { memo, useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { SlotProps } from '../../registry/slots.ts'
import { bindSessionView, type SessionViewService } from '../../infrastructure/session-view.ts'

/** 按键不驱动受控 value；仅防抖更新发送按钮可用态，避免每个字符打穿 React 渲染。 */
const INPUT_DEBOUNCE_MS = 120

export const ChatComposer = memo(function ChatComposer(props: SlotProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const canSubmitRef = useRef(false)
  const [canSubmit, setCanSubmit] = useState(false)
  const useSessionView = props.useSessionView as ReturnType<typeof bindSessionView>
  const pending = useSessionView((state) => state.pending)
  const sessionView = props.sessionView as SessionViewService
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(
    () => () => {
      if (debounceRef.current != null) clearTimeout(debounceRef.current)
    },
    [],
  )

  function scheduleCanSubmit(value: string) {
    const next = Boolean(value.trim())
    if (debounceRef.current != null) clearTimeout(debounceRef.current)
    if (next === canSubmitRef.current) return
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      canSubmitRef.current = next
      setCanSubmit(next)
    }, INPUT_DEBOUNCE_MS)
  }

  function clearInput() {
    if (debounceRef.current != null) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    const el = textareaRef.current
    if (el) el.value = ''
    canSubmitRef.current = false
    setCanSubmit(false)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (debounceRef.current != null) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    const content = (textareaRef.current?.value ?? '').trim()
    if (!content) return
    clearInput()
    try {
      await sessionView.send(content, pending ? 'inject' : 'wake')
      const id = sessionView.get().sessionId
      if (id && !location.pathname.startsWith(`/s/${id}`)) navigate(`/s/${id}`)
    } catch {
      /* error 已写入 sessionView */
    }
  }

  return (
    <form
      className="w-full border border-[var(--dsw-border)] bg-[var(--dsw-input)]"
      style={{ borderRadius: 'var(--dsw-radius-bubble)', boxShadow: 'var(--dsw-shadow-lv2)' }}
      onSubmit={onSubmit}
    >
      <textarea
        ref={textareaRef}
        className="max-h-40 min-h-[52px] w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-[15px] text-[var(--dsw-label)] outline-none placeholder:text-[var(--dsw-label-3)]"
        defaultValue=""
        rows={1}
        placeholder={pending ? 'Steer while running…' : 'Message DeepSeek Harness…'}
        aria-label="对话输入"
        onChange={(event) => scheduleCanSubmit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            event.currentTarget.form?.requestSubmit()
          }
        }}
      />
      <div className="flex items-center justify-end gap-2 px-3 pb-3">
        {pending ? (
          <>
            <button
              className="rounded-full border border-[var(--dsw-border)] px-3 py-1.5 text-xs text-[var(--dsw-label-2)] hover:bg-black/5"
              type="button"
              onClick={() => void sessionView.cancel()}
            >
              Cancel
            </button>
            <button
              className="rounded-full px-3 py-1.5 text-xs text-white disabled:opacity-40"
              style={{ background: 'var(--dsw-business)' }}
              type="submit"
              disabled={!canSubmit}
            >
              Steer
            </button>
          </>
        ) : (
          <button
            className="grid size-8 place-items-center rounded-full text-white disabled:opacity-40"
            style={{ background: 'var(--dsw-business)' }}
            type="submit"
            disabled={!canSubmit}
            aria-label="Send"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
              <path d="M3.4 20.6 21 12 3.4 3.4 3 10.3 15 12 3 13.7z" />
            </svg>
          </button>
        )}
      </div>
    </form>
  )
})
