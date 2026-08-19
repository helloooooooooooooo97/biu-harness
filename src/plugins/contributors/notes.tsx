import { useEffect, useState, type FormEvent } from 'react'
import type { Context } from 'cordis'
import type { SlotProps } from '../registry/slots.ts'

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
    <article className="space-y-2 rounded-2xl bg-[#2d2e30] px-3 py-3">
      <h2 className="text-sm font-medium">便签</h2>
      <p className="text-xs leading-5 text-[#9aa0a6]">POST /api/notes；关掉便签后本卡会卸掉。</p>
      <form className="flex gap-2" onSubmit={onSubmit}>
        <input
          className="min-w-0 flex-1 rounded-xl border border-[#3c4043] bg-[#1b1c1d] px-3 py-2 text-sm outline-none"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="写一条便签"
        />
        <button className="rounded-xl bg-[#4d6bfe] px-3 py-2 text-sm text-white" type="submit">
          记下
        </button>
      </form>
      {notes.map((note) => (
        <div className="rounded-lg bg-[#1b1c1d] px-3 py-2 font-mono text-xs text-[#c4c7c5]" key={note.id}>
          {note.body}
        </div>
      ))}
    </article>
  )
}

export function apply(ctx: Context) {
  ctx.slots.place('rail', NotesCard, { key: 'notes', order: 15 })
}
