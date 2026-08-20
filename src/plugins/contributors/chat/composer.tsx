import { useState, type FormEvent } from 'react'
import type { SlotProps } from '../../registry/slots.ts'
import { useChatStore } from './store.ts'

export function ChatComposer(_props: SlotProps) {
  const [input, setInput] = useState('')
  const busy = useChatStore((state) => state.pending)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const content = input.trim()
    const store = useChatStore.getState()
    if (!content || store.pending) return
    setInput('')
    store.pushMessage({ role: 'user', content })
    store.setPending(true)
    try {
      let sessionId = store.sessionId
      if (!sessionId) {
        const created = await fetch('/api/sessions', { method: 'POST' })
        const body = (await created.json()) as { id?: string }
        if (!body.id) throw new Error('无法创建 session')
        sessionId = body.id
        useChatStore.getState().setSessionId(sessionId)
      }
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, text: content }),
      })
      const data = await res.json()
      if (data.sessionId) useChatStore.getState().setSessionId(data.sessionId)
      useChatStore.getState().pushMessage({ role: 'assistant', content: data.text || data.error || '请求失败' })
    } catch (error) {
      useChatStore.getState().pushMessage({ role: 'assistant', content: String(error) })
    } finally {
      useChatStore.getState().setPending(false)
    }
  }

  return (
    <form
      className="flex items-end gap-2 rounded-[28px] border border-[#3c4043] bg-[#2d2e30] px-4 py-2 shadow-lg"
      onSubmit={onSubmit}
    >
      <textarea
        className="max-h-40 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-sm text-[#e8eaed] outline-none placeholder:text-[#9aa0a6]"
        value={input}
        rows={1}
        disabled={busy}
        placeholder="发给助手…"
        aria-label="对话输入"
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            event.currentTarget.form?.requestSubmit()
          }
        }}
      />
      <button
        className="mb-0.5 rounded-full bg-[#4d6bfe] px-3 py-2 text-xs font-medium text-white hover:bg-[#6280ff] disabled:opacity-50"
        type="submit"
        disabled={busy}
      >
        发送
      </button>
    </form>
  )
}
