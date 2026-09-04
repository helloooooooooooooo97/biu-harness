import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bars3BottomLeftIcon, CheckIcon } from '@heroicons/react/16/solid'
import { listenOutsideDismiss } from '@biu/public-ui'
import { normalizePageSize, PAGE_SIZES } from './saved-view.ts'

function menuPos(el: HTMLElement | null) {
  const box = el?.getBoundingClientRect()
  if (!box) return null
  return {
    right: Math.max(8, window.innerWidth - box.right),
    bottom: Math.max(8, window.innerHeight - box.top + 6),
  }
}

/** 每页条数菜单自己管开合，避免点开时把整张表跟着 setState。 */
export function PagerSizeControl({
  pageSize,
  onChange,
}: {
  pageSize: number
  onChange: (size: number) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ right: number; bottom: number } | null>(null)

  useEffect(() => {
    if (!open) return
    return listenOutsideDismiss(
      () => setOpen(false),
      (target) => Boolean(wrapRef.current?.contains(target) || menuRef.current?.contains(target)),
    )
  }, [open])

  return (
    <div className="fsdb-pager-size" ref={wrapRef}>
      <button
        type="button"
        className={`tasks-icon-btn fsdb-pager-size-btn${open ? ' is-active' : ''}`}
        aria-label={`每页 ${pageSize} 条`}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`每页 ${pageSize} 条`}
        onClick={() => {
          if (open) {
            setOpen(false)
            return
          }
          setPos(menuPos(wrapRef.current))
          setOpen(true)
        }}
      >
        <Bars3BottomLeftIcon aria-hidden className="size-[14px]" />
        <span>{pageSize}</span>
      </button>
      {open && pos
        ? createPortal(
            <div
              ref={menuRef}
              className="fsdb-pager-size-menu"
              role="menu"
              style={{ right: pos.right, bottom: pos.bottom }}
            >
              {PAGE_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  className={`fsdb-pager-size-option${size === pageSize ? ' is-active' : ''}`}
                  role="menuitem"
                  onClick={() => {
                    setOpen(false)
                    const next = normalizePageSize(size)
                    if (next !== pageSize) onChange(next)
                  }}
                >
                  {size}
                  {size === pageSize ? <CheckIcon aria-hidden className="size-[14px]" /> : null}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
