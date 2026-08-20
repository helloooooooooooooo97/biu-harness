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
    <article className="space-y-2 rounded-[12px] border border-[var(--dsw-border)] bg-white px-3 py-3">
      <h2 className="text-sm font-medium">Notes demo</h2>
      <p className="text-xs leading-5 text-[var(--dsw-label-3)]">POST /api/notes — unloads with notes plugin.</p>
      <form className="flex gap-2" onSubmit={onSubmit}>
        <input
          className="min-w-0 flex-1 rounded-[12px] border border-[var(--dsw-border)] px-3 py-2 text-sm outline-none"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write a note"
        />
        <button
          className="rounded-[12px] px-3 py-2 text-sm text-white"
          style={{ background: 'var(--dsw-business)' }}
          type="submit"
        >
          Save
        </button>
      </form>
      {notes.map((note) => (
        <div className="rounded-[8px] bg-[var(--dsw-sidebar)] px-3 py-2 font-mono text-xs text-[var(--dsw-label-2)]" key={note.id}>
          {note.body}
        </div>
      ))}
    </article>
  )
}

export function apply(ctx: Context) {
  ctx.slots.place('demos', NotesCard, { key: 'notes', order: 15 })
}
