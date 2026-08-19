import { useState, useSyncExternalStore, type FormEvent } from 'react'
import type { SlotProps } from '../../registry/slots.ts'
import { emit, getMessages, getPending, pushMessage, setPending, subscribe } from './store.ts'

export function ChatComposer(_props: SlotProps) {
  const [input, setInput] = useState('')
  const busy = useSyncExternalStore(subscribe, getPending, getPending)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const content = input.trim()
    if (!content || getPending()) return
    setInput('')
    pushMessage({ role: 'user', content })
    setPending(true)
    emit()
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: getMessages() }),
      })
      const data = await res.json()
      pushMessage({ role: 'assistant', content: data.text || data.error || '请求失败' })
    } catch (error) {
      pushMessage({ role: 'assistant', content: String(error) })
    } finally {
      setPending(false)
      emit()
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
