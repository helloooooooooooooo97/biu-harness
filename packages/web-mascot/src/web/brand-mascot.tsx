import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { SidebarMascot } from './sidebar-mascot.tsx'
import { resolveSessionMascot } from './session-mascot.ts'

export type CornerAgent = {
  id: string
  title: string
  updatedAt?: number
  type?: string
  mascot?: { shape: string; color: string; eye?: number }
  project?: { name: string; path?: string }
  tags?: string[]
}

function AgentTags({ tags }: { tags?: string[] }) {
  const list = (tags ?? []).map((tag) => tag.trim()).filter(Boolean)
  if (!list.length) return <span className="brand-agent-tags is-empty">—</span>
  const shown = list.slice(0, 2)
  const extra = list.length - shown.length
  return (
    <span className="brand-agent-tags">
      {shown.map((tag) => (
        <span key={tag} className="brand-agent-tag">
          {tag}
        </span>
      ))}
      {extra > 0 ? <span className="brand-agent-tag is-more">+{extra}</span> : null}
    </span>
  )
}

export function BrandMascot({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, '')
  return (
    <svg className={className} viewBox="-15 -15 259 259" width={36} height={36} fill="none" aria-hidden>
      <defs>
        <linearGradient id={uid} x1="0" y1="0.15" x2="1" y2="0.85">
          <stop offset="0%" stopColor="color-mix(in srgb, #0066B0 42%, var(--dsw-hover))" />
          <stop offset="52%" stopColor="color-mix(in srgb, #5B3E90 40%, var(--dsw-hover))" />
          <stop offset="100%" stopColor="color-mix(in srgb, #E22726 42%, var(--dsw-hover))" />
        </linearGradient>
      </defs>
      <path
        d="M0.27 170.27C0.27 94.06 51.31 32.27 114.27 32.27C177.23 32.27 228.27 94.06 228.27 170.27L228.27 170.27C228.27 196.27 228.27 196.27 202.27 196.27L26.27 196.27C0.27 196.27 0.27 196.27 0.27 170.27Z"
        fill={`url(#${uid})`}
      />
      <g transform="translate(114.2705 118.2705) scale(1.003 0.68) translate(-114.2705 -114.2705)">
        <path
          d="M39.78 104.3L42.64 105.01L45.03 106.74L46.73 109.15L47.75 111.93L48.35 114.83L48.81 117.76L49.31 120.68L49.87 123.6L50.48 126.5L51.15 129.39L51.86 132.27L52.63 135.13L53.44 137.98L54.3 140.82L55.19 143.65L56.13 146.46L57.1 149.26L58.1 152.05L58.86 154.92L58.96 157.87L58.18 160.72L56.43 163.09L53.84 164.48L50.9 164.62L48.08 163.75L45.58 162.16L43.51 160.05L41.89 157.57L40.67 154.87L39.67 152.08L38.73 149.26L37.81 146.44L36.94 143.61L36.11 140.76L35.34 137.9L34.61 135.03L33.92 132.14L33.28 129.24L32.7 126.34L32.16 123.42L31.67 120.5L31.23 117.57L31.14 114.61L31.65 111.69L32.74 108.94L34.47 106.54L36.89 104.86Z"
          fill="#fff"
        />
        <path
          d="M108.97 125.73L111.9 126.2L114.63 127.37L117 129.16L118.84 131.49L119.99 134.23L120.32 137.18L119.85 140.11L118.59 142.8L116.78 145.16L114.84 147.42L112.89 149.67L110.93 151.92L108.97 154.16L107.01 156.39L105.03 158.62L103.05 160.85L101.07 163.06L99.07 165.28L97.09 167.5L95.09 169.71L93.05 171.88L90.69 173.67L87.89 174.66L84.93 174.81L82.02 174.22L79.31 173L76.92 171.24L74.99 168.98L73.7 166.3L73.26 163.37L73.74 160.45L75.2 157.86L77.17 155.63L79.18 153.43L81.18 151.23L83.17 149.02L85.16 146.8L87.14 144.58L89.11 142.35L91.08 140.11L93.04 137.87L95 135.63L96.95 133.38L98.89 131.12L100.87 128.89L103.25 127.12L106.02 126.04Z"
          fill="#fff"
        />
      </g>
    </svg>
  )
}

export function BrandCornerMascot({
  agents = [],
  activeId,
  onSelect,
  leading,
}: {
  agents?: CornerAgent[]
  activeId?: string | null
  onSelect?: (id: string) => void
  leading?: ReactNode
}) {
  const [agentsOpen, setAgentsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const ranked = useMemo(
    () => [...agents].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0) || a.id.localeCompare(b.id)),
    [agents],
  )
  const current = ranked.find((item) => item.id === activeId) ?? ranked[0]
  const identity = current ? resolveSessionMascot(current.id, current.mascot) : undefined

  useEffect(() => {
    if (!agentsOpen) return
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setAgentsOpen(false)
    }
    window.addEventListener('mousedown', onPointer)
    return () => window.removeEventListener('mousedown', onPointer)
  }, [agentsOpen])

  return (
    <div className="brand-corner-cluster" ref={rootRef} data-testid="brand-corner-mascot">
      {leading ? <div className="brand-corner-leading">{leading}</div> : null}
      <div className="brand-corner-mascot">
        <button
          type="button"
          className={`brand-corner-mascot-btn${agentsOpen ? ' is-active' : ''}`}
          title={current ? `切换 Agent，当前：${current.title}` : '切换 Agent'}
          aria-label={current ? `切换 Agent，当前：${current.title}` : '切换 Agent'}
          aria-haspopup="menu"
          aria-expanded={agentsOpen}
          data-testid="brand-corner-mascot-toggle"
          onClick={() => setAgentsOpen((prev) => !prev)}
        >
          {identity && current ? (
            <SidebarMascot size={36} sessionId={current.id} identity={identity} animate={false} title={current.title} />
          ) : (
            <BrandMascot className="size-9" />
          )}
        </button>
        {agentsOpen ? (
          <div className="brand-agent-menu" role="menu" data-testid="brand-agent-menu">
            {ranked.length ? (
              ranked.map((item) => {
                const face = resolveSessionMascot(item.id, item.mascot)
                const active = item.id === (activeId ?? current?.id)
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    className={`inspector-catalog-item${active ? ' is-active' : ''}`}
                    data-testid={`brand-agent-${item.id}`}
                    onClick={() => {
                      onSelect?.(item.id)
                      setAgentsOpen(false)
                    }}
                  >
                    <SidebarMascot size={24} sessionId={item.id} identity={face} animate={false} title={item.title} />
                    <span className="brand-agent-copy">
                      <span className="brand-agent-title">
                        {(item.type ?? 'chat') === 'live' ? <span className="brand-agent-live">live</span> : null}
                        {item.title}
                      </span>
                      <span className="brand-agent-meta">
                        <span className="brand-agent-project" title={item.project?.path || item.project?.name || undefined}>
                          {item.project?.name?.trim() || '—'}
                        </span>
                        <AgentTags tags={item.tags} />
                      </span>
                    </span>
                  </button>
                )
              })
            ) : (
              <p className="inspector-catalog-empty">还没有 Agent</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
