/**
 * 回归：已加载过的消息「跳回去」不得重新挂载整行。
 *
 * 虚表窗口滑动会 unmount/remount → Markdown/工具卡都会闪加载。
 * ChatNodeList 全量常驻 DOM，模拟上滑再瞬间下滑后 mount 次数应仍为 1。
 */
import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import {
  getCachedMarkdownHtml,
  parseMarkdownSync,
  resetMarkdownRenderForTests,
} from './markdown-render.ts'
import { MarkdownBody } from './markdown.tsx'
import { ChatNodeList } from './thread.tsx'
import type { ChatNode } from '@biu/web-session-view'

afterEach(() => {
  cleanup()
  resetMarkdownRenderForTests()
  vi.restoreAllMocks()
})

function MountProbe({ id, onMount }: { id: string; onMount: (id: string) => void }) {
  useEffect(() => {
    onMount(id)
  }, [id, onMount])
  return <div data-testid={`row-${id}`} data-node-id={id} />
}

/** 旧虚表行为：只挂窗口内行 → 滑走再滑回会二次 mount */
function WindowedList({
  ids,
  window,
  onMount,
}: {
  ids: string[]
  window: [number, number]
  onMount: (id: string) => void
}) {
  const slice = ids.slice(window[0], window[1])
  return (
    <div>
      {slice.map((id) => (
        <MountProbe key={id} id={id} onMount={onMount} />
      ))}
    </div>
  )
}

/** 现行策略：全部常驻 */
function StickyList({ ids, onMount }: { ids: string[]; onMount: (id: string) => void }) {
  return (
    <div>
      {ids.map((id) => (
        <MountProbe key={id} id={id} onMount={onMount} />
      ))}
    </div>
  )
}

describe('scroll-back remount contract', () => {
  it('windowed virtual list remounts a row when scrolling away and back (the bug)', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `n${i}`)
    const mounts = new Map<string, number>()
    const onMount = (id: string) => mounts.set(id, (mounts.get(id) ?? 0) + 1)

    const { rerender } = render(<WindowedList ids={ids} window={[10, 15]} onMount={onMount} />)
    expect(mounts.get('n12')).toBe(1)

    // 上滑到更早
    rerender(<WindowedList ids={ids} window={[0, 5]} onMount={onMount} />)
    expect(screen.queryByTestId('row-n12')).toBeNull()

    // 瞬间滑回
    rerender(<WindowedList ids={ids} window={[10, 15]} onMount={onMount} />)
    expect(screen.getByTestId('row-n12')).toBeTruthy()
    expect(mounts.get('n12')).toBe(2)
  })

  it('sticky full list does NOT remount when scroll focus moves away and back', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `n${i}`)
    const mounts = new Map<string, number>()
    const onMount = (id: string) => mounts.set(id, (mounts.get(id) ?? 0) + 1)

    const { rerender } = render(<StickyList ids={ids} onMount={onMount} />)
    expect(mounts.get('n12')).toBe(1)

    // 模拟「视口关注点」变化：列表本身不卸行，只 rerender
    rerender(<StickyList ids={ids} onMount={onMount} />)
    rerender(<StickyList ids={ids} onMount={onMount} />)

    expect(screen.getByTestId('row-n12')).toBeTruthy()
    expect(mounts.get('n12')).toBe(1)
  })

  it('ChatNodeList keeps all rows in DOM after re-render (scroll-back safe)', () => {
    const nodes: ChatNode[] = Array.from({ length: 24 }, (_, i) => ({
      id: `u-${i}`,
      kind: 'user',
      text: `message **${i}** with markdown`,
    }))
    const onInspect = vi.fn()
    const onFork = vi.fn(async () => {})

    const { rerender } = render(<ChatNodeList nodes={nodes} onInspect={onInspect} onFork={onFork} />)

    expect(document.querySelectorAll('[data-node-id]')).toHaveLength(24)
    expect(document.querySelector('[data-node-id="u-3"]')).toBeTruthy()
    expect(document.querySelector('[data-node-id="u-20"]')).toBeTruthy()

    // 模拟上滑 10 条再滑回：父级重渲，行必须还在
    rerender(<ChatNodeList nodes={nodes} onInspect={onInspect} onFork={onFork} />)
    expect(document.querySelectorAll('[data-node-id]')).toHaveLength(24)
    expect(document.querySelector('[data-node-id="u-3"]')).toBeTruthy()
    expect(document.querySelector('[data-node-id="u-20"]')).toBeTruthy()
  })

  it('MarkdownBody remount with warm cache paints HTML on first frame (no stream flash)', () => {
    const text = 'hello **world** remount'
    parseMarkdownSync(text)
    expect(getCachedMarkdownHtml(text)).toContain('<strong>world</strong>')

    const { unmount, container } = render(<MarkdownBody text={text} />)
    expect(container.querySelector('.chat-md-stream')).toBeNull()
    expect(container.querySelector('strong')?.textContent).toBe('world')
    unmount()

    const second = render(<MarkdownBody text={text} />)
    expect(second.container.querySelector('.chat-md-stream')).toBeNull()
    expect(second.container.querySelector('strong')?.textContent).toBe('world')
  })
})

describe('markdown cache helpers', () => {
  it('parse once then getCached hits', () => {
    const text = 'cache **hit** check'
    const html = parseMarkdownSync(text)
    expect(getCachedMarkdownHtml(text)).toBe(html)
  })
})
