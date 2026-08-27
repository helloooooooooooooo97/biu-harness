import { useEffect } from 'react'
import type { PickService } from './service.ts'
import { usePickState } from './service.ts'
import { boxFromPoints, resolvePickAtPoint, resolvePicksInRect } from './resolve.ts'

const DRAG_PX = 6

function hoverBox(el: HTMLElement) {
  const box = el.getBoundingClientRect()
  return { top: box.top, left: box.left, width: box.width, height: box.height }
}

export function PickOverlay({ pick }: { pick: PickService }) {
  const { picking, hover, marquee, marqueeHits } = usePickState(pick)

  useEffect(() => {
    if (!picking) {
      document.documentElement.classList.remove('pick-mode')
      return
    }
    document.documentElement.classList.add('pick-mode')
    const route = () => window.location.pathname
    let drag: { x: number; y: number; boxed: boolean } | null = null

    const onMove = (event: PointerEvent) => {
      if (drag) {
        const dx = event.clientX - drag.x
        const dy = event.clientY - drag.y
        if (!drag.boxed && dx * dx + dy * dy >= DRAG_PX * DRAG_PX) drag.boxed = true
        if (!drag.boxed) return
        const box = boxFromPoints(drag.x, drag.y, event.clientX, event.clientY)
        const hits = resolvePicksInRect(box, route())
        pick.setMarquee(
          { top: box.top, left: box.left, width: box.width, height: box.height },
          hits.map((hit) => hoverBox(hit.el)),
        )
        return
      }
      const hit = resolvePickAtPoint(event.clientX, event.clientY, route())
      if (!hit) {
        pick.setHover(null)
        return
      }
      pick.setHover(hoverBox(hit.el))
    }

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      const target = event.target
      if (target instanceof Element && target.closest('[data-biu-ignore]')) return
      event.preventDefault()
      drag = { x: event.clientX, y: event.clientY, boxed: false }
    }

    const onUp = (event: PointerEvent) => {
      if (!drag) return
      const started = drag
      drag = null
      if (started.boxed) {
        const box = boxFromPoints(started.x, started.y, event.clientX, event.clientY)
        pick.addMany(resolvePicksInRect(box, route()).map((hit) => hit.ref))
        return
      }
      const hit = resolvePickAtPoint(event.clientX, event.clientY, route())
      if (hit) pick.add(hit.ref)
    }

    const onClick = (event: MouseEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('[data-biu-ignore]')) return
      event.preventDefault()
      event.stopPropagation()
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        pick.exit()
      }
    }

    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('pointermove', onMove, true)
    window.addEventListener('pointerup', onUp, true)
    window.addEventListener('click', onClick, true)
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.documentElement.classList.remove('pick-mode')
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('pointermove', onMove, true)
      window.removeEventListener('pointerup', onUp, true)
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

  if (!picking) return null
  return (
    <>
      {marquee ? (
        <div
          className="pick-overlay-box pick-overlay-marquee"
          data-biu-ignore
          data-testid="pick-marquee"
          style={{
            top: marquee.top,
            left: marquee.left,
            width: marquee.width,
            height: marquee.height,
          }}
        />
      ) : null}
      {(marquee ? marqueeHits : hover ? [hover] : []).map((box, index) => (
        <div
          key={`${box.left}-${box.top}-${index}`}
          className="pick-overlay-box pick-overlay-hit"
          data-biu-ignore
          style={{
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height,
          }}
        />
      ))}
    </>
  )
}
