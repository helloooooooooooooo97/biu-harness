import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function AnchorMenu({
  anchor,
  onClose,
  children,
  className = 'fsdb-cellselect-menu',
  role = 'listbox',
  zIndex = 80,
}: {
  anchor: HTMLElement | null
  onClose: () => void
  children: ReactNode
  className?: string
  role?: string
  zIndex?: number
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ top: 0, left: 0, width: 200 })

  useLayoutEffect(() => {
    if (!anchor) return
    const place = () => {
      const rect = anchor.getBoundingClientRect()
      const width = Math.max(220, rect.width)
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
  }, [anchor])

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (menuRef.current?.contains(target) || anchor?.contains(target)) return
      onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [anchor, onClose])

  if (!anchor) return null
  return createPortal(
    <div
      ref={menuRef}
      className={className}
      role={role}
      style={{ position: 'fixed', top: box.top, left: box.left, width: box.width, zIndex }}
    >
      {children}
    </div>,
    document.body,
  )
}
