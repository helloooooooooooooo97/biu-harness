/** @vitest-environment jsdom */
import { test, afterEach } from 'vitest'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { OverlayChatWindow } from './overlay-window.tsx'
import { closeChatOverlay, getChatOverlay, setChatOverlay } from './chat-overlay.ts'

let root: Root | null = null
let host: HTMLDivElement | null = null

afterEach(() => {
  act(() => {
    root?.unmount()
  })
  host?.remove()
  root = null
  host = null
  setChatOverlay(false)
  try {
    localStorage.removeItem('cordis.overlay.geom')
  } catch {
    /* ignore */
  }
})

test('clicking the overlay close button actually closes the overlay', () => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  setChatOverlay(true)
  const header = createElement(
    'button',
    { type: 'button', 'data-testid': 'chat-overlay-close' },
    'close',
  )
  act(() => {
    root!.render(
      createElement(OverlayChatWindow, {
        header,
        thread: createElement('div'),
        dock: createElement('div'),
      }),
    )
  })
  assert.equal(getChatOverlay(), true)
  const close = document.querySelector('[data-testid="chat-overlay-close"]')
  assert.ok(close)
  act(() => {
    close!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
  })
  assert.equal(getChatOverlay(), false)
  closeChatOverlay()
})

test('overlay opens docked to the right and vertically centered', () => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
  act(() => {
    root!.render(
      createElement(OverlayChatWindow, {
        header: createElement('div'),
        thread: createElement('div'),
        dock: createElement('div'),
      }),
    )
  })
  const panel = document.querySelector('[data-testid="chat-overlay-panel"]') as HTMLElement
  assert.ok(panel)
  assert.equal(panel.getAttribute('data-overlay-layout'), 'right')
  assert.equal(document.querySelector('[data-testid="chat-overlay-drag"]'), null)
  assert.ok(Number.parseFloat(panel.style.left) > 700)
  const top = Number.parseFloat(panel.style.top)
  const height = Number.parseFloat(panel.style.height)
  assert.ok(top > 40)
  assert.ok(top + height < 800)
  assert.equal(document.querySelector('[data-testid="chat-overlay-layout-toggle"]'), null)
  assert.equal(document.querySelector('[data-testid="chat-overlay-layout"]'), null)
})

test('overlay header close button has no layout control beside it', () => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  act(() => {
    root!.render(
      createElement(OverlayChatWindow, {
        header: createElement(
          'header',
          { className: 'chat-view-header' },
          createElement('div', { className: 'chat-view-header-left' }, 'project'),
          createElement(
            'div',
            { className: 'chat-view-header-right' },
            createElement('button', { type: 'button', 'data-testid': 'chat-overlay-close' }, 'x'),
          ),
        ),
        thread: createElement('div'),
        dock: createElement('div'),
      }),
    )
  })
  const right = document.querySelector('.chat-view-header-right')
  assert.ok(right)
  assert.equal(right.querySelector('[data-testid="chat-overlay-layout-toggle"]'), null)
  assert.ok(right.querySelector('[data-testid="chat-overlay-close"]'))
})
