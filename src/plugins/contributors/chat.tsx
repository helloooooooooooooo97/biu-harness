import { useState, useSyncExternalStore, type FormEvent } from 'react'
import type { Context } from 'cordis'
import type { SlotProps } from '../registry/slots.ts'

export const name = 'chat-ui'
export const inject = ['slots']

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const listeners = new Set<() => void>()
let messages: ChatMessage[] = []
let pending = false

function emit() {
  for (const fn of listeners) fn()
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function ChatThread(_props: SlotProps) {
  const list = useSyncExternalStore(subscribe, () => messages, () => messages)
  const busy = useSyncExternalStore(subscribe, () => pending, () => pending)
  if (!list.length && !busy) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
        <p className="text-lg font-medium">有什么可以帮你？</p>
        <p className="mt-2 text-sm text-[#9aa0a6]">底部输入后走 POST /api/chat；关掉「对话」插件会卸掉输入框。</p>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      {list.map((item, index) => (
        <div
          key={`${item.role}-${index}`}
          className={item.role === 'user' ? 'ml-10 self-end rounded-2xl bg-[#4d6bfe] px-4 py-3 text-sm text-white' : 'mr-10 self-start rounded-2xl bg-[#2d2e30] px-4 py-3 text-sm leading-6'}
        >
          {item.content}
        </div>
      ))}
      {busy ? <div className="mr-10 self-start text-sm text-[#9aa0a6]">思考中…</div> : null}
    </div>
  )
}

function ChatComposer(_props: SlotProps) {
  const [input, setInput] = useState('')
  const busy = useSyncExternalStore(subscribe, () => pending, () => pending)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const content = input.trim()
    if (!content || pending) return
    setInput('')
    messages = [...messages, { role: 'user', content }]
    pending = true
    emit()
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages }),
      })
      const data = await res.json()
      messages = [...messages, { role: 'assistant', content: data.text || data.error || '请求失败' }]
    } catch (error) {
      messages = [...messages, { role: 'assistant', content: String(error) }]
    } finally {
      pending = false
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

export function apply(ctx: Context) {
  ctx.slots.inject('stage', () => ctx.slots.fill('stage', ChatThread, { key: 'chat-thread', order: 1 }))
  ctx.slots.inject('composer', () => ctx.slots.fill('composer', ChatComposer, { key: 'chat', order: 10 }))
}
