import type { ReactNode } from 'react'

const STYLE_ID = 'biu-public-ui-tag-chip'
const CSS = `
.biu-tag-wrap{border:0;background:transparent;padding:0;cursor:pointer;font:inherit}
.biu-tags{display:inline-flex;flex-wrap:wrap;gap:4px;align-items:center;min-width:0;max-width:100%}
.biu-tag{display:inline-flex;align-items:center;gap:2px;height:20px;padding:0 6px;border-radius:4px;font-size:13px;font-weight:500;line-height:20px;background:color-mix(in srgb,var(--biu-tag,#5b9fd6) 22%,transparent);color:var(--biu-tag,#5b9fd6);max-width:160px}
.biu-tag.is-btn{cursor:pointer}
.biu-tag.is-on{background:color-mix(in srgb,var(--biu-tag,#5b9fd6) 34%,transparent)}
.biu-tag-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.biu-tag-x{border:0;background:transparent;padding:0;margin:0;color:inherit;opacity:.55;cursor:pointer;display:inline-flex;line-height:0}
.biu-tag-x:hover{opacity:1}
`

export const TAG_TONES = ['#5b9fd6', '#9a6dd7', '#d9730d', '#448361', '#c4554d', '#e255a1', '#c2920a', '#787774'] as const

export function tagTone(id: string) {
  let hash = 0
  const key = String(id ?? '')
  for (let i = 0; i < key.length; i += 1) hash = (hash * 33 + key.charCodeAt(i)) >>> 0
  return TAG_TONES[hash % TAG_TONES.length]!
}

export function ensureTagChipStyle() {
  if (typeof document === 'undefined') return
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = STYLE_ID
    document.head.appendChild(style)
  }
  if (style.textContent !== CSS) style.textContent = CSS
}

function CloseMark() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
      <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 1 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z" />
    </svg>
  )
}

export function TagChip({
  id,
  label,
  onRemove,
  onClick,
  active,
}: {
  id: string
  label: string
  onRemove?: () => void
  onClick?: () => void
  active?: boolean
}) {
  ensureTagChipStyle()
  const chip = (
    <span
      className={`biu-tag${active ? ' is-on' : ''}${onClick ? ' is-btn' : ''}`}
      style={{ ['--biu-tag' as string]: tagTone(id) }}
      title={label}
    >
      <span className="biu-tag-label">{label}</span>
      {onRemove ? (
        <button
          type="button"
          className="biu-tag-x"
          aria-label={`移除 ${label}`}
          onClick={(event) => {
            event.stopPropagation()
            onRemove()
          }}
        >
          <CloseMark />
        </button>
      ) : null}
    </span>
  )
  if (!onClick) return chip
  return (
    <button type="button" className="biu-tag-wrap" onClick={onClick}>
      {chip}
    </button>
  )
}

export function TagChips({ children }: { children: ReactNode }) {
  ensureTagChipStyle()
  return <span className="biu-tags">{children}</span>
}
