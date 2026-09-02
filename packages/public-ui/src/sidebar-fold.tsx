import { useLayoutEffect, useRef, useState, type ReactNode, type TransitionEvent } from 'react'

export function SidebarFold({
  open,
  children,
  className,
}: {
  open: boolean
  children: ReactNode
  className?: string
}) {
  const [animating, setAnimating] = useState(false)
  const openRef = useRef(open)
  useLayoutEffect(() => {
    if (openRef.current === open) return
    openRef.current = open
    setAnimating(true)
  }, [open])

  function onTransitionEnd(event: TransitionEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return
    if (event.propertyName !== 'grid-template-rows') return
    setAnimating(false)
  }

  return (
    <div
      className={`sidebar-fold${open ? ' is-open' : ''}${animating ? ' is-animating' : ''}${className ? ` ${className}` : ''}`}
      aria-hidden={!open}
      onTransitionEnd={onTransitionEnd}
    >
      <div className="sidebar-fold-inner" inert={!open || undefined}>
        {children}
      </div>
    </div>
  )
}
