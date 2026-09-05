import { useEffect, useState } from 'react'
import { ArrowPathIcon, CpuChipIcon, UserIcon } from '@heroicons/react/16/solid'
import { SidebarMascot, resolveSessionMascot } from '@biu/public-mascot'
import { asPerson, personKey, type PersonValue } from '@biu/type-file-system'

type ChatPerson = {
  id: string
  name: string
  mascot?: { shape: string; color: string; eye?: number }
}

const USER: PersonValue = { kind: 'user', name: '用户' }
const SYSTEM: PersonValue = { kind: 'system', name: '系统' }

async function loadAgents(): Promise<ChatPerson[]> {
  const res = await fetch('/api/sessions')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = (await res.json()) as {
    sessions?: Array<{ id?: string; title?: string; mascot?: ChatPerson['mascot'] }>
  }
  if (!Array.isArray(body.sessions)) return []
  return body.sessions
    .filter((item) => typeof item?.id === 'string' && item.id)
    .map((item) => ({
      id: item.id as string,
      name: item.title?.trim() || (item.id as string).slice(0, 8),
      ...(item.mascot ? { mascot: item.mascot } : {}),
    }))
}

export function PersonFace({ value, empty = '' }: { value: unknown; empty?: string }) {
  const person = asPerson(value)
  if (!person) {
    return empty ? (
      <span className="fsdb-person is-empty">
        <UserIcon aria-hidden className="size-[14px]" />
        {empty}
      </span>
    ) : null
  }
  return (
    <span className="fsdb-person" title={person.sessionId ? `${person.name} · ${person.sessionId.slice(0, 8)}` : person.name}>
      {person.kind === 'agent' && person.sessionId ? (
        <span className="fsdb-person-face" aria-hidden>
          <SidebarMascot
            size={18}
            sessionId={person.sessionId}
            identity={resolveSessionMascot(person.sessionId)}
            animate={false}
            title={person.name}
          />
        </span>
      ) : (
        <span className="fsdb-person-avatar" aria-hidden>
          {person.kind === 'system' ? <CpuChipIcon className="size-[14px]" /> : <UserIcon className="size-[14px]" />}
        </span>
      )}
      <span className="fsdb-person-name">{person.name}</span>
    </span>
  )
}

export function PersonPickPanel({
  value,
  onChange,
  onPicked,
}: {
  value: unknown
  onChange: (next: PersonValue) => void
  onPicked?: () => void
}) {
  const current = asPerson(value)
  const selected = personKey(current)
  const [people, setPeople] = useState<ChatPerson[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void loadAgents()
      .then((rows) => {
        if (!cancelled) setPeople(rows)
      })
      .catch(() => {
        if (!cancelled) setPeople([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function pick(next: PersonValue) {
    onChange(next)
    onPicked?.()
  }

  return (
    <div className="fsdb-person-pick">
      <button
        type="button"
        className={`fsdb-person-option${selected === 'user' ? ' is-selected' : ''}`}
        onClick={() => pick(USER)}
      >
        <span className="fsdb-person-avatar" aria-hidden>
          <UserIcon className="size-[14px]" />
        </span>
        <span className="fsdb-person-name">用户</span>
      </button>
      <button
        type="button"
        className={`fsdb-person-option${selected === 'system' ? ' is-selected' : ''}`}
        onClick={() => pick(SYSTEM)}
      >
        <span className="fsdb-person-avatar" aria-hidden>
          <CpuChipIcon className="size-[14px]" />
        </span>
        <span className="fsdb-person-name">系统</span>
      </button>
      {people.map((person) => (
        <button
          type="button"
          key={person.id}
          className={`fsdb-person-option${selected === person.id ? ' is-selected' : ''}`}
          onClick={() => pick({ kind: 'agent', name: person.name, sessionId: person.id })}
        >
          <span className="fsdb-person-face" aria-hidden>
            <SidebarMascot
              size={18}
              sessionId={person.id}
              identity={resolveSessionMascot(person.id, person.mascot)}
              animate={false}
              title={person.name}
            />
          </span>
          <span className="fsdb-person-name">{person.name}</span>
        </button>
      ))}
      {loading ? (
        <div className="fsdb-person-loading">
          <ArrowPathIcon className="size-[14px] fsdb-spin" aria-hidden />
          加载会话…
        </div>
      ) : null}
    </div>
  )
}
