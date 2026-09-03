import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  DocumentIcon,
  MagnifyingGlassIcon,
  PuzzlePieceIcon,
  Squares2X2Icon,
  TagIcon,
} from '@heroicons/react/16/solid'
import { TagChip, TagChips } from '@biu/public-ui'

export type SearchKind = 'session' | 'task' | 'page' | 'plugin' | 'facet'

export const SEARCH_SCOPES: Array<{
  id: SearchKind
  label: string
  path: string | null
}> = [
  { id: 'session', label: '会话', path: null },
  { id: 'task', label: '任务', path: '/tasks' },
  { id: 'page', label: '页面', path: '/pages' },
  { id: 'plugin', label: '插件', path: '/plugins' },
  { id: 'facet', label: '类型', path: '/facets' },
]

const PER_KIND = 8
const DEBOUNCE_MS = 160

export type SearchHit = {
  kind: SearchKind
  id: string
  title: string
}

export type SessionHint = { id: string; title: string }

function recordTitle(row: Record<string, unknown>) {
  const title = row.title ?? row.name ?? row.label
  const text = String(title ?? '').trim()
  return text || String(row.id ?? '')
}

export function searchCollection(kind: SearchKind) {
  if (kind === 'session') return '/sessions'
  return SEARCH_SCOPES.find((item) => item.id === kind)?.path ?? `/${kind}`
}

/** 在右侧检查器打开记录，不改路由、不换主 Session。 */
export function openSearchHit(hit: { kind: SearchKind; id: string }) {
  window.dispatchEvent(
    new CustomEvent('biu:inspector-reveal', {
      detail: { collection: searchCollection(hit.kind), recordId: hit.id },
    }),
  )
}

function matchLocal(title: string, id: string, needle: string) {
  if (!needle) return true
  return title.toLowerCase().includes(needle) || id.toLowerCase().includes(needle)
}

async function listKind(path: string, query: string, signal: AbortSignal) {
  const params = new URLSearchParams({
    path,
    limit: String(PER_KIND),
    offset: '0',
    q: query,
    sort: 'updatedAt',
    dir: 'desc',
    filter: '{}',
  })
  const res = await fetch(`/api/db/list?${params}`, { signal })
  const body = (await res.json()) as { items?: Array<Record<string, unknown>> }
  return Array.isArray(body.items) ? body.items : []
}

function KindGlyph({ kind, compact }: { kind: SearchKind | 'all'; compact?: boolean }) {
  const className = compact ? 'size-3 shrink-0' : 'size-4 shrink-0'
  if (kind === 'all') return <Squares2X2Icon className={className} />
  if (kind === 'session') return <ChatBubbleLeftRightIcon className={className} />
  if (kind === 'task') return <CheckCircleIcon className={className} />
  if (kind === 'page') return <DocumentIcon className={className} />
  if (kind === 'plugin') return <PuzzlePieceIcon className={className} />
  return <TagIcon className={className} />
}

export function ShellSearchPanel({
  sessions,
  onClose,
  focusSeq = 0,
}: {
  sessions: SessionHint[]
  onClose: () => void
  focusSeq?: number
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<'all' | SearchKind>('all')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [busy, setBusy] = useState(false)
  const [active, setActive] = useState(0)
  const cacheRef = useRef(new Map<string, SearchHit[]>())

  useLayoutEffect(() => {
    const node = inputRef.current
    if (!node) return
    node.focus()
  }, [focusSeq])

  const needle = query.trim().toLowerCase()

  const localSessions = useMemo(() => {
    return sessions
      .filter((item) => matchLocal(item.title, item.id, needle))
      .slice(0, PER_KIND)
      .map((item) => ({
        kind: 'session' as const,
        id: item.id,
        title: item.title || item.id,
      }))
  }, [needle, sessions])

  useEffect(() => {
    const keyOf = (kind: SearchKind) => `${kind}\0${needle}`
    const remote = SEARCH_SCOPES.filter((item) => item.path && (scope === 'all' || item.id === scope))
    const allRemote = SEARCH_SCOPES.filter((item) => item.path)
    const fromCache = allRemote.flatMap((item) => cacheRef.current.get(keyOf(item.id)) ?? [])
    if (!needle && scope === 'all') {
      setHits([])
      setBusy(false)
      return
    }
    if (fromCache.length) setHits(fromCache)
    if (!remote.length) {
      setBusy(false)
      return
    }
    const missing = remote.filter((item) => !cacheRef.current.has(keyOf(item.id)))
    if (!missing.length) {
      setHits(fromCache)
      setBusy(false)
      return
    }
    const ac = new AbortController()
    const timer = window.setTimeout(() => {
      setBusy(true)
      void Promise.all(
        missing.map(async (item) => {
          try {
            const rows = await listKind(item.path!, needle, ac.signal)
            return rows.map((row) => {
              const id = String(row.id ?? '')
              return {
                kind: item.id,
                id,
                title: recordTitle(row),
              } satisfies SearchHit
            })
          } catch {
            return [] as SearchHit[]
          }
        }),
      ).then((groups) => {
        if (ac.signal.aborted) return
        groups.forEach((rows, index) => {
          const kind = missing[index]?.id
          if (kind) cacheRef.current.set(keyOf(kind), rows)
        })
        setHits(allRemote.flatMap((item) => cacheRef.current.get(keyOf(item.id)) ?? []))
        setBusy(false)
      })
    }, needle ? DEBOUNCE_MS : 0)
    return () => {
      ac.abort()
      window.clearTimeout(timer)
    }
  }, [needle, scope])

  const grouped = useMemo(() => {
    const sessionHits = scope === 'all' || scope === 'session' ? localSessions : []
    const remote = hits.filter((item) => scope === 'all' || item.kind === scope)
    const order: SearchKind[] = ['session', 'task', 'page', 'plugin', 'facet']
    return order
      .map((kind) => ({
        kind,
        label: SEARCH_SCOPES.find((item) => item.id === kind)?.label ?? kind,
        items: kind === 'session' ? sessionHits : remote.filter((item) => item.kind === kind),
      }))
      .filter((group) => group.items.length)
  }, [hits, localSessions, scope])

  const flat = grouped.flatMap((group) => group.items)
  const current = flat[Math.min(active, Math.max(0, flat.length - 1))]

  const openHit = (hit: SearchHit) => {
    openSearchHit(hit)
    onClose()
  }

  let cursor = -1

  return (
    <div
      className="shell-search-overlay"
      data-testid="shell-search-overlay"
      onClick={onClose}
    >
      <div
        className="shell-search-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="搜索"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="shell-search-field">
          <button
            type="button"
            className="shell-search-go"
            title="搜索"
            aria-label="搜索"
            aria-busy={busy}
            onClick={() => inputRef.current?.focus()}
          >
            <MagnifyingGlassIcon className="size-4 shrink-0" />
          </button>
          <input
            ref={inputRef}
            className="shell-search-input"
            autoFocus
            placeholder="搜索会话、任务、页面、插件、类型"
            value={query}
            data-testid="shell-search-input"
            onChange={(event) => {
              setQuery(event.target.value)
              setActive(0)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                onClose()
                return
              }
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActive((prev) => Math.min(prev + 1, Math.max(0, flat.length - 1)))
                return
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActive((prev) => Math.max(prev - 1, 0))
                return
              }
              if (event.key === 'Enter' && current) {
                event.preventDefault()
                openHit(current)
              }
            }}
          />
        </div>
        <div className="shell-search-scopes" role="tablist" aria-label="搜索范围">
          <TagChips>
            <TagChip
              id="all"
              label="全部"
              active={scope === 'all'}
              icon={<KindGlyph kind="all" compact />}
              onClick={() => setScope('all')}
            />
            {SEARCH_SCOPES.map((item) => (
              <TagChip
                key={item.id}
                id={item.id}
                label={item.label}
                active={scope === item.id}
                icon={<KindGlyph kind={item.id} compact />}
                onClick={() => setScope(item.id)}
              />
            ))}
          </TagChips>
        </div>
        <div className="shell-search-body" aria-busy={busy}>
          {!needle && scope === 'all' && !flat.length ? (
            <p className="shell-search-hint">
              会话用已加载的列表即时筛；其它类型并行各取最多 {PER_KIND} 条，输入后再请求。
            </p>
          ) : null}
          {grouped.map((group) => (
            <section key={group.kind} className="shell-search-group">
              <h3 className="shell-search-group-title">{group.label}</h3>
              {group.items.map((item) => {
                cursor += 1
                const index = cursor
                return (
                  <button
                    type="button"
                    key={`${item.kind}:${item.id}`}
                    className={`shell-search-hit${index === active ? ' is-active' : ''}`}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => openHit(item)}
                  >
                    <span className="shell-search-hit-icon" aria-hidden>
                      <KindGlyph kind={item.kind} />
                    </span>
                    <span className="shell-search-hit-title">{item.title}</span>
                  </button>
                )
              })}
            </section>
          ))}
          {!busy && needle && !flat.length ? (
            <p className="shell-search-hint">没有匹配「{query.trim()}」的结果</p>
          ) : null}
        </div>
        <div className="shell-search-foot">
          <span>⌘F 搜索</span>
          <span>↑↓ 选择</span>
          <span>↵ 打开</span>
          <span>esc 关闭</span>
        </div>
      </div>
    </div>
  )
}
