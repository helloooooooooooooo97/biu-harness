import { useState, type FormEvent } from 'react'
import type { Context } from 'cordis'

/** 与主仓 slots 约定兼容的最小 props（避免包依赖主仓源码）。 */
export type SlotProps = Record<string, unknown>

type SlotsService = {
  place: (slot: string, view: unknown, opts: { key: string; order: number }) => unknown
}

export const name = 'hello-ui'
export const inject = ['slots']

function HelloCard(_props: SlotProps) {
  const [name, setName] = useState('Cordis')
  const [text, setText] = useState('')

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const res = await fetch(`/api/greet?name=${encodeURIComponent(name)}`)
    const data = (await res.json()) as { text?: string; error?: string }
    setText(data.text || data.error || '')
  }

  return (
    <article className="space-y-2 rounded-[12px] border border-[var(--dsw-border)] bg-[var(--dsw-surface)] px-3 py-3">
      <h2 className="text-sm font-medium">Greeting demo</h2>
      <p className="text-xs leading-5 text-[var(--dsw-label-3)]">
        独立包 <code>@biu/cap-greeter/web</code> · fetch /api/greet · 随 greeter 热插拔
      </p>
      <form className="flex gap-2" onSubmit={onSubmit}>
        <input
          className="min-w-0 flex-1 rounded-[12px] border border-[var(--dsw-border)] px-3 py-2 text-sm outline-none"
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label="名字"
        />
        <button
          className="rounded-[12px] px-3 py-2 text-sm text-[var(--dsw-bg)]"
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
  const slots = ctx.get('slots') as SlotsService | undefined
  if (!slots) throw new Error('slots service required')
  slots.place('demos', HelloCard, { key: 'hello', order: 10 })
}
