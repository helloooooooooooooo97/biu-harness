import { useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { HeadlessDismiss } from './headless-dismiss.tsx'

export function AnchorMenu({
  anchor,
  onClose,
  children,
  className = 'fsdb-cellselect-menu',
  role = 'listbox',
  zIndex = 200,
  minWidth = 220,
  ...rest
}: {
  anchor: HTMLElement | null
  onClose: () => void
  children: ReactNode
  className?: string
  role?: string
  zIndex?: number
  minWidth?: number
} & Omit<HTMLAttributes<HTMLDivElement>, 'role' | 'className' | 'children'>) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ top: 0, left: 0, width: 200 })

  useLayoutEffect(() => {
    if (!anchor) return
    const place = () => {
      const rect = anchor.getBoundingClientRect()
      const width = Math.max(minWidth, rect.width)
      const left = Math.min(rect.left, Math.max(8, window.innerWidth - width - 8))
      const top = rect.bottom + 4
      setBox({ top, left, width })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [anchor, minWidth])

  if (!anchor) return null
  return createPortal(
    <HeadlessDismiss onDismiss={onClose} inside={(node) => Boolean(anchor.contains(node))}>
      <div
        ref={menuRef}
        className={className}
        role={role}
        style={{ position: 'fixed', top: box.top, left: box.left, width: box.width, zIndex }}
        {...rest}
      >
        {children}
      </div>
    </HeadlessDismiss>,
    document.body,
  )
}
