import { useState, type FormEvent } from 'react'
import type { SlotProps } from '../../registry/slots.ts'
import { bindSessionView, type SessionViewService } from '../../infrastructure/session-view.ts'

export function ChatComposer(props: SlotProps) {
  const [input, setInput] = useState('')
  const useSessionView = props.useSessionView as ReturnType<typeof bindSessionView>
  const pending = useSessionView((state) => state.pending)
  const sessionView = props.sessionView as SessionViewService

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const content = input.trim()
    if (!content) return
    setInput('')
    try {
      await sessionView.send(content, pending ? 'inject' : 'wake')
    } catch {
      /* error 已写入 sessionView */
    }
  }

  return (
    <form
      className="mx-auto w-full max-w-[calc(var(--dsw-chat-width)+32px)] border border-[var(--dsw-border)] bg-[var(--dsw-input)]"
      style={{ borderRadius: 'var(--dsw-radius-bubble)', boxShadow: 'var(--dsw-shadow-lv2)' }}
      onSubmit={onSubmit}
    >
      <textarea
        className="max-h-40 min-h-[52px] w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-[15px] text-[var(--dsw-label)] outline-none placeholder:text-[var(--dsw-label-3)]"
        value={input}
        rows={1}
        placeholder={pending ? 'Steer while running…' : 'Message DeepSeek Harness…'}
        aria-label="对话输入"
        onChange={(event) => setInput(event.target.value)}
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
              disabled={!input.trim()}
            >
              Steer
            </button>
          </>
        ) : (
          <button
            className="grid size-8 place-items-center rounded-full text-white disabled:opacity-40"
            style={{ background: 'var(--dsw-business)' }}
            type="submit"
            disabled={!input.trim()}
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
}
