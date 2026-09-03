import { useCallback, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { OutlineNav } from '@biu/public-ui'
import { headingsFromRoot } from './heading-outline.ts'

function escapeId(id: string) {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(id) : id
}

export function HeadingOutline({ enabled }: { enabled: boolean }) {
  const [host, setHost] = useState<HTMLElement | null>(null)
  const [items, setItems] = useState(() => [] as ReturnType<typeof headingsFromRoot>)

  const scan = useCallback(() => {
    const stage = document.querySelector('.fsdb-detail-stage')
    const main = document.querySelector('.fsdb-detail-main')
    if (!(main instanceof HTMLElement)) {
      setItems([])
      return
    }
    const root = main.closest('.fsdb-right') ?? main.closest('.fsdb-right-body') ?? stage
    setHost(root instanceof HTMLElement ? root : main)
    setItems(headingsFromRoot(main))
  }, [])

  useLayoutEffect(() => {
    if (!enabled) {
      setItems([])
      setHost(null)
      return
    }
    scan()
    const main = document.querySelector('.fsdb-detail-main')
    if (!(main instanceof HTMLElement)) return
    const mo = new MutationObserver(scan)
    mo.observe(main, { subtree: true, childList: true, characterData: true })
    return () => mo.disconnect()
  }, [enabled, scan])

  const go = useCallback((id: string) => {
    const el = document.querySelector<HTMLElement>(`[data-heading-outline="${escapeId(id)}"]`)
    el?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [])

  if (!enabled || !host || !items.length) return null
  return createPortal(
    <div className="heading-outline-host">
      <OutlineNav items={items} label="标题大纲" testId="heading-outline" onSelect={go} />
    </div>,
    host,
  )
}
