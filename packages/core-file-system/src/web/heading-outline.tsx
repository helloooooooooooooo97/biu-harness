import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { OutlineNav } from '@biu/public-ui'
import { headingElById, headingsFromRoot, sameOutlineItems } from './heading-outline.ts'

function detailMain(from: HTMLElement | null) {
  const stage = from?.closest('.fsdb-detail-stage')
  const scoped = stage?.querySelector('.fsdb-detail-main')
  return scoped instanceof HTMLElement ? scoped : null
}

export function HeadingOutline({ enabled }: { enabled: boolean }) {
  const mark = useRef<HTMLSpanElement>(null)
  const [host, setHost] = useState<HTMLElement | null>(null)
  const [items, setItems] = useState(() => [] as ReturnType<typeof headingsFromRoot>)

  const scan = useCallback(() => {
    const main = detailMain(mark.current)
    const stage = mark.current?.closest('.fsdb-detail-stage')
    if (!main) {
      setItems((prev) => (prev.length ? [] : prev))
      return
    }
    const root = main.closest('.fsdb-right') ?? main.closest('.fsdb-right-body') ?? stage
    const nextHost = root instanceof HTMLElement ? root : main
    setHost((prev) => (prev === nextHost ? prev : nextHost))
    const next = headingsFromRoot(main)
    setItems((prev) => (sameOutlineItems(prev, next) ? prev : next))
  }, [])

  useLayoutEffect(() => {
    if (!enabled) {
      setItems((prev) => (prev.length ? [] : prev))
      setHost(null)
      return
    }
    scan()
    const main = detailMain(mark.current)
    if (!main) return
    const mo = new MutationObserver(scan)
    mo.observe(main, { subtree: true, childList: true, characterData: true })
    return () => mo.disconnect()
  }, [enabled, scan])

  const go = useCallback((id: string) => {
    const main = detailMain(mark.current)
    if (!main) return
    headingElById(main, id)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [])

  if (!enabled) return null
  return (
    <>
      <span ref={mark} hidden aria-hidden="true" data-heading-outline-anchor="" />
      {host && items.length
        ? createPortal(
            <div className="heading-outline-host">
              <OutlineNav items={items} label="标题大纲" testId="heading-outline" onSelect={go} />
            </div>,
            host,
          )
        : null}
    </>
  )
}
