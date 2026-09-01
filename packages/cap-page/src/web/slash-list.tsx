import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { SlashItem } from './slash.ts'

function slashIcon(id: string) {
  if (id === 'h1') return 'H1'
  if (id === 'h2') return 'H2'
  if (id === 'h3') return 'H3'
  if (id === 'bullet') return '•'
  if (id === 'ordered') return '1.'
  if (id === 'quote') return '“'
  if (id === 'code') return '</>'
  if (id === 'divider') return '—'
  return 'T'
}

/** 只滚菜单自己，避免 scrollIntoView 把页面/编辑器卷走、光标乱插空段。 */
export function scrollMenuChild(list: HTMLElement, item: HTMLElement) {
  const top = item.offsetTop
  const bottom = top + item.offsetHeight
  const viewTop = list.scrollTop
  const viewBottom = viewTop + list.clientHeight
  if (top < viewTop) list.scrollTop = top
  else if (bottom > viewBottom) list.scrollTop = bottom - list.clientHeight
}

export const SlashList = forwardRef(function SlashList(
  {
    items,
    command,
  }: {
    items: SlashItem[]
    command: (item: SlashItem) => void
  },
  ref,
) {
  const [active, setActive] = useState(0)
  const activeRef = useRef(0)
  const listRef = useRef<HTMLDivElement>(null)
  const keyNav = useRef(false)
  activeRef.current = active

  useEffect(() => {
    setActive(0)
  }, [items])

  useEffect(() => {
    if (!keyNav.current) return
    keyNav.current = false
    const list = listRef.current
    const item = list?.querySelector<HTMLElement>('.page-slash-item.is-active')
    if (list && item) scrollMenuChild(list, item)
  }, [active, items])

  useImperativeHandle(ref, () => ({
    onKeyDown({ event }: { event: KeyboardEvent }) {
      if (!items.length) return false
      if (event.key === 'ArrowUp') {
        keyNav.current = true
        setActive((index) => (index + items.length - 1) % items.length)
        return true
      }
      if (event.key === 'ArrowDown') {
        keyNav.current = true
        setActive((index) => (index + 1) % items.length)
        return true
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        const item = items[activeRef.current]
        if (item) command(item)
        return true
      }
      return false
    },
  }))

  return (
    <div
      ref={listRef}
      className="page-slash"
      id="slash-command"
      role="listbox"
      aria-label="插入模块"
      data-testid="page-slash"
      onWheel={(event) => event.stopPropagation()}
    >
      <div className="page-slash-head">基础模块</div>
      {items.length ? (
        items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={index === active}
            className={`page-slash-item${index === active ? ' is-active' : ''}`}
            onMouseEnter={() => setActive(index)}
            onMouseDown={(event) => {
              event.preventDefault()
              command(item)
            }}
          >
            <span className="page-slash-icon">{slashIcon(item.id)}</span>
            <span className="page-slash-copy">
              <span className="page-slash-label">{item.label}</span>
              <span className="page-slash-hint">{item.hint}</span>
            </span>
          </button>
        ))
      ) : (
        <div className="page-slash-empty">没有匹配的模块</div>
      )}
    </div>
  )
})
