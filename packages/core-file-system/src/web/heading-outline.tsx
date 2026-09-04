import { useCallback, useLayoutEffect, useState } from 'react'
import { OutlineNav, SidebarOutlinePortal } from '@biu/public-ui'
import { headingElById, headingsFromRoot, sameOutlineItems } from './heading-outline.ts'

export function HeadingOutline({ enabled }: { enabled: boolean }) {
  const [items, setItems] = useState(() => [] as ReturnType<typeof headingsFromRoot>)

  const scan = useCallback(() => {
    const main = document.querySelector('.fsdb-detail-main')
    if (!(main instanceof HTMLElement)) {
      setItems((prev) => (prev.length ? [] : prev))
      return
    }
    const next = headingsFromRoot(main)
    setItems((prev) => (sameOutlineItems(prev, next) ? prev : next))
  }, [])

  useLayoutEffect(() => {
    if (!enabled) {
      setItems((prev) => (prev.length ? [] : prev))
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
    const main = document.querySelector('.fsdb-detail-main')
    if (!(main instanceof HTMLElement)) return
    headingElById(main, id)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [])

  if (!enabled || !items.length) return null
  return (
    <SidebarOutlinePortal testId="heading-outline-host">
      <OutlineNav items={items} label="标题大纲" testId="heading-outline" onSelect={go} />
    </SidebarOutlinePortal>
  )
}
