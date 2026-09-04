import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { findOutlineSidebarHost } from './outline-sidebar.ts'

function agentCenterAllowsOutline(anchor: HTMLElement | null) {
  const center = anchor?.closest('[data-testid="agent-center"]')
  if (!(center instanceof HTMLElement)) return true
  return !center.classList.contains('hidden') && center.getAttribute('aria-hidden') !== 'true'
}

/** 把悬浮目录挂到壳层，贴左侧栏；聊天中心被藏起时不泄漏。 */
export function SidebarOutlinePortal({
  children,
  testId,
}: {
  children: ReactNode
  testId?: string
}) {
  const mark = useRef<HTMLSpanElement>(null)
  const [host, setHost] = useState<HTMLElement | null>(null)
  const [allowed, setAllowed] = useState(false)

  useLayoutEffect(() => {
    const sync = () => {
      const next = findOutlineSidebarHost()
      setHost((prev) => (prev === next ? prev : next))
      setAllowed(agentCenterAllowsOutline(mark.current))
    }
    sync()
    const mo = new MutationObserver(sync)
    const center = mark.current?.closest('[data-testid="agent-center"]')
    if (center instanceof HTMLElement) {
      mo.observe(center, { attributes: true, attributeFilter: ['class', 'aria-hidden'] })
    }
    const shell = document.querySelector('[data-testid="app-shell"]')
    if (shell instanceof HTMLElement) {
      mo.observe(shell, { attributes: true, attributeFilter: ['style', 'class'] })
    }
    const frame = requestAnimationFrame(sync)
    return () => {
      mo.disconnect()
      cancelAnimationFrame(frame)
    }
  })

  return (
    <>
      <span ref={mark} hidden aria-hidden="true" data-outline-anchor="" />
      {allowed && host && children
        ? createPortal(
            <div className="sidebar-outline-host" data-testid={testId}>
              {children}
            </div>,
            host,
          )
        : null}
    </>
  )
}
