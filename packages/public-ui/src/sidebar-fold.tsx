import type { ReactNode } from 'react'

export function SidebarFold({
  open,
  children,
  className,
}: {
  open: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`sidebar-fold${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`} aria-hidden={!open}>
      <div className="sidebar-fold-inner" inert={!open || undefined}>
        {children}
      </div>
    </div>
  )
}
