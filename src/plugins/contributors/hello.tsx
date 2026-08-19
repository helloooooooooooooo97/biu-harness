import { useState, type FormEvent } from 'react'
import type { Context } from 'cordis'
import type { SlotProps } from '../registry/slots.ts'

export const name = 'hello-ui'
export const inject = ['slots']

function HelloCard(_props: SlotProps) {
  const [name, setName] = useState('Cordis')
  const [text, setText] = useState('')

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const res = await fetch(`/api/greet?name=${encodeURIComponent(name)}`)
    const data = await res.json()
    setText(data.text || data.error)
  }

  return (
    <article className="space-y-2 rounded-2xl bg-[#2d2e30] px-3 py-3">
      <h2 className="text-sm font-medium">问候</h2>
      <p className="text-xs leading-5 text-[#9aa0a6]">fetch /api/greet；关掉问候服务后本卡会卸掉。</p>
      <form className="flex gap-2" onSubmit={onSubmit}>
        <input
          className="min-w-0 flex-1 rounded-xl border border-[#3c4043] bg-[#1b1c1d] px-3 py-2 text-sm outline-none"
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label="名字"
        />
        <button className="rounded-xl bg-[#4d6bfe] px-3 py-2 text-sm text-white" type="submit">
          问候
        </button>
      </form>
      {text ? <div className="rounded-lg bg-[#1b1c1d] px-3 py-2 font-mono text-xs">{text}</div> : null}
    </article>
  )
}

export function apply(ctx: Context) {
  ctx.slots.place('rail', HelloCard, { key: 'hello', order: 10 })
}
