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
    if (!content || pending) return
    setInput('')
    try {
      await sessionView.send(content)
    } catch {
      /* error 已写入 sessionView */
    }
  }

  return (
    <div className="space-y-2">
      <form
        className="flex items-end gap-2 rounded-[28px] border border-[#3c4043] bg-[#2d2e30] px-4 py-2 shadow-lg"
        onSubmit={onSubmit}
      >
        <textarea
          className="max-h-40 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-sm text-[#e8eaed] outline-none placeholder:text-[#9aa0a6]"
          value={input}
          rows={1}
          disabled={pending}
          placeholder="发给助手（写入 session，经 agents 驱动）…"
          aria-label="对话输入"
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
        />
        {pending ? (
          <button
            className="mb-0.5 rounded-full border border-[#5f6368] px-3 py-2 text-xs text-[#e8eaed] hover:bg-[#3c4043]"
            type="button"
            onClick={() => void sessionView.cancel()}
          >
            取消
          </button>
        ) : (
          <button
            className="mb-0.5 rounded-full bg-[#4d6bfe] px-3 py-2 text-xs font-medium text-white hover:bg-[#6280ff] disabled:opacity-50"
            type="submit"
            disabled={!input.trim()}
          >
            发送
          </button>
        )}
      </form>
    </div>
  )
}
