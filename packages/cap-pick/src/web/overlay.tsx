import { useEffect } from 'react'
import type { PickService } from './service.ts'
import { usePickState } from './service.ts'
import { resolvePickAtPoint } from './resolve.ts'

export function PickOverlay({ pick }: { pick: PickService }) {
  const { picking, hover } = usePickState(pick)

  useEffect(() => {
    if (!picking) {
      document.documentElement.classList.remove('pick-mode')
      return
    }
    document.documentElement.classList.add('pick-mode')
    const route = () => window.location.pathname

    const onMove = (event: MouseEvent) => {
      const hit = resolvePickAtPoint(event.clientX, event.clientY, route())
      if (!hit) {
        pick.setHover(null)
        return
      }
      const box = hit.el.getBoundingClientRect()
      pick.setHover({ top: box.top, left: box.left, width: box.width, height: box.height })
    }

    const onClick = (event: MouseEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('[data-biu-ignore]')) return
      event.preventDefault()
      event.stopPropagation()
      const hit = resolvePickAtPoint(event.clientX, event.clientY, route())
      if (hit) pick.add(hit.ref)
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        pick.exit()
      }
    }

    window.addEventListener('mousemove', onMove, true)
    window.addEventListener('click', onClick, true)
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.documentElement.classList.remove('pick-mode')
      window.removeEventListener('mousemove', onMove, true)
      window.removeEventListener('click', onClick, true)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [picking, pick])

  useEffect(() => {
    const onHotkey = (event: KeyboardEvent) => {
      if (!(event.altKey && (event.key === 'c' || event.key === 'C'))) return
      if (event.repeat) return
      event.preventDefault()
      pick.toggle()
    }
    window.addEventListener('keydown', onHotkey)
    return () => window.removeEventListener('keydown', onHotkey)
  }, [pick])

  if (!picking || !hover) return null
  return (
    <div
      className="pick-overlay-box"
      data-biu-ignore
      style={{
        top: hover.top,
        left: hover.left,
        width: hover.width,
        height: hover.height,
      }}
    />
  )
}
