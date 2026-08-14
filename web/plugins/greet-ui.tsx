import { useState, type FormEvent } from 'react'
import type { Context } from 'cordis'
import type { SlotProps } from '../ui-slots/types.ts'

export const name = 'greet-ui'
export const inject = ['slots']

function GreetCard(_props: SlotProps) {
  const [name, setName] = useState('Cordis')
  const [text, setText] = useState('')

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const res = await fetch(`/api/greet?name=${encodeURIComponent(name)}`)
    const data = await res.json()
    setText(data.text || data.error)
  }

  return (
    <article className="card">
      <h3>问候</h3>
      <p className="sub">slots.inject('stage') 贡献的 keyed React 卡片</p>
      <form onSubmit={onSubmit}>
        <input value={name} onChange={(event) => setName(event.target.value)} />
        <button className="act" type="submit">
          问候
        </button>
      </form>
      {text ? <div className="output">{text}</div> : null}
    </article>
  )
}

export function apply(ctx: Context) {
  ctx.slots.inject('stage', () =>
    ctx.slots.register({ name: 'stage', key: 'greet' }, GreetCard),
  )
}
