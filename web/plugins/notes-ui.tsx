import { useEffect, useState, type FormEvent } from 'react'
import type { Context } from 'cordis'
import type { SlotProps } from '../ui-slots/types.ts'

export const name = 'notes-ui'
export const inject = ['slots']

interface Note {
  id: string
  body: string
}

function NotesCard(_props: SlotProps) {
  const [body, setBody] = useState('')
  const [notes, setNotes] = useState<Note[]>([])

  async function load() {
    const res = await fetch('/api/notes')
    const data = await res.json()
    setNotes(data.notes || [])
  }

  useEffect(() => {
    void load()
  }, [])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    await fetch('/api/notes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body }),
    })
    setBody('')
    await load()
  }

  return (
    <article className="card">
      <h3>便签</h3>
      <p className="sub">stage 是 list slot，多张卡片并存；卸载服务端插件会撤掉这条 inject</p>
      <form onSubmit={onSubmit}>
        <input value={body} onChange={(event) => setBody(event.target.value)} placeholder="写一条便签" />
        <button className="act" type="submit">
          记下
        </button>
      </form>
      <div>
        {notes.map((note) => (
          <div className="note" key={note.id}>
            {note.body}
          </div>
        ))}
      </div>
    </article>
  )
}

export function apply(ctx: Context) {
  ctx.slots.inject('stage', () =>
    ctx.slots.register({ name: 'stage', key: 'notes' }, NotesCard),
  )
}
