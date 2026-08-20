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
    <article className="space-y-2 rounded-[12px] border border-[var(--dsw-border)] bg-white px-3 py-3">
      <h2 className="text-sm font-medium">Greeting demo</h2>
      <p className="text-xs leading-5 text-[var(--dsw-label-3)]">fetch /api/greet — unloads with greeter plugin.</p>
      <form className="flex gap-2" onSubmit={onSubmit}>
        <input
          className="min-w-0 flex-1 rounded-[12px] border border-[var(--dsw-border)] px-3 py-2 text-sm outline-none"
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label="名字"
        />
        <button
          className="rounded-[12px] px-3 py-2 text-sm text-white"
          style={{ background: 'var(--dsw-business)' }}
          type="submit"
        >
          Greet
        </button>
      </form>
      {text ? <div className="rounded-[8px] bg-[var(--dsw-sidebar)] px-3 py-2 font-mono text-xs">{text}</div> : null}
    </article>
  )
}

export function apply(ctx: Context) {
  ctx.slots.place('demos', HelloCard, { key: 'hello', order: 10 })
}
