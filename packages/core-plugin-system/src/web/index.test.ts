import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context, Service } from 'cordis'
import * as slots from '@biu/web-slots'
import * as dock from '@biu/core-dock'
import type { CollectionChrome, CollectionViewType, DatabaseUi } from '@biu/type-file-system/ui'
import * as plugins2Ui from './index.tsx'

class FakeDatabaseUi extends Service implements DatabaseUi {
  last: { path: string; chrome: CollectionChrome } | null = null
  constructor(ctx: Context) {
    super(ctx, 'databaseUi')
  }
  decorate(path: string, chrome: CollectionChrome) {
    this.last = { path, chrome }
    return { dispose() {} }
  }
  chrome() {
    return this.last?.chrome ?? {}
  }
  registerView() {
    return { dispose() {} }
  }
  views() {
    return [] as CollectionViewType[]
  }
  subscribe() {
    return () => undefined
  }
}

test('plugin system web declares extras so store plugins can mount windows', async () => {
  const ctx = new Context()
  await ctx.plugin(slots)
  await ctx.plugin(dock)
  new FakeDatabaseUi(ctx)
  ctx.slots.fill('root', () => null, {
    children: {
      'root-overlays': { kind: 'list' },
    },
  })
  await ctx.plugin(plugins2Ui)
  assert.equal(ctx.slots.list('root-overlays').some((item) => item.id === 'plugin-store-extras-layer'), true)
  assert.ok(ctx.slots.specOf('plugin-store-extras'))
})

test('plugin system web passes name/tags/action chrome into databaseUi', async () => {
  const ctx = new Context()
  await ctx.plugin(slots)
  await ctx.plugin(dock)
  const ui = new FakeDatabaseUi(ctx)
  ctx.slots.fill('root', () => null, {
    children: {
      'root-overlays': { kind: 'list' },
    },
  })
  await ctx.plugin(plugins2Ui)
  assert.equal(ui.last?.path, '/plugins')
  assert.equal(typeof ui.last?.chrome.Title, 'function')
  assert.equal(typeof ui.last?.chrome.cells?.author, 'function')
  assert.equal(typeof ui.last?.chrome.cells?.tags, 'function')
  assert.equal(typeof ui.last?.chrome.Action, 'function')
})

test('plugin window sizes from manifest.shell instead of measuring DOM', async () => {
  const { readFile } = await import('node:fs/promises')
  const { resolve } = await import('node:path')
  const src = await readFile(resolve(import.meta.dirname, './index.tsx'), 'utf8')
  assert.match(src, /data-shell-width=\{shell\.width\}/)
  assert.match(src, /storeShellFromRecord/)
  assert.match(src, /dismissAndStop/)
  assert.match(src, /dismissed\[entry\.id\]/)
  assert.match(src, /listingIsHeadless/)
  assert.match(src, /extraProps\.headless === true/)
  assert.doesNotMatch(src, /measurePluginBox/)
  assert.doesNotMatch(src, /ResizeObserver/)
  const create = await readFile(resolve(import.meta.dirname, '../host/plugin-create.ts'), 'utf8')
  assert.match(create, /manifest\.shell/)
})

test('plugin window hover controls sit on the right without a title bar', async () => {
  const { readFile } = await import('node:fs/promises')
  const { resolve } = await import('node:path')
  const src = await readFile(resolve(import.meta.dirname, './index.tsx'), 'utf8')
  assert.match(src, /data-plugin-move/)
  assert.match(src, /plugin-window-move/)
  assert.match(src, /Bars2Icon/)
  assert.match(src, /移动窗口/)
  assert.doesNotMatch(src, /if \(\(event\.target as HTMLElement\)\.closest\('button'\)\) return/)
  assert.match(src, /onPointerLeave=\{closeControlsSoon\}/)
  assert.match(src, /storeShellFromRecord/)
  assert.match(src, /left-full/)
  assert.match(src, /pl-1\.5/)
  assert.doesNotMatch(src, /w-16/)
  assert.match(src, /size-8/)
  assert.match(src, /data-controls-place/)
  assert.match(src, /inside/)
  assert.match(src, /fullscreen \? undefined : openControls/)
  assert.match(src, /width: '100vw'/)
  assert.match(src, /height: '100vh'/)
  assert.doesNotMatch(src, /100vw - 32px/)
  assert.match(src, /flex-col/)
  assert.match(src, /bg-white\/10/)
  assert.match(src, /disabled=\{!shell\.resizable\}/)
  assert.doesNotMatch(src, /bg-white\/55/)
  assert.doesNotMatch(src, /bg-\[#202020\]/)
  assert.doesNotMatch(src, /bg-\[#ff5f57\]/)
  assert.doesNotMatch(src, /bottom-4 left-1\/2/)
  assert.match(src, /dock\.register/)
  assert.match(src, /PuzzlePieceIcon/)
  assert.match(src, /ExtraIcon/)
})

test('bundled store plugins register their own dock icons', async () => {
  const { readFile } = await import('node:fs/promises')
  const { resolve } = await import('node:path')
  const root = resolve(import.meta.dirname, '../../../../.plugin')
  const hello = await readFile(resolve(root, 'store-hello/web.js'), 'utf8')
  const gomoku = await readFile(resolve(root, 'store-gomoku/web.js'), 'utf8')
  const ping = await readFile(resolve(root, 'store-heavy-ping/web.js'), 'utf8')
  assert.match(hello, /Icon: HelloDockIcon/)
  assert.match(gomoku, /Icon: GomokuDockIcon/)
  assert.match(ping, /Icon: HeavyPingDockIcon/)
})

test('packed page-excalidraw plugin stores scenes as page assets', async () => {
  const { readFile } = await import('node:fs/promises')
  const { resolve } = await import('node:path')
  const src = await readFile(resolve(import.meta.dirname, '../../../../.plugin-dev/page-excalidraw/web.tsx'), 'utf8')
  const manifest = JSON.parse(
    await readFile(resolve(import.meta.dirname, '../../../../.plugin/page-excalidraw/manifest.json'), 'utf8'),
  ) as { headless?: boolean }
  assert.equal(manifest.headless, true)
  assert.match(src, /\/api\/page\/file\//)
  assert.match(src, /method: 'PUT'/)
  assert.match(src, /viewModeEnabled=\{!canEdit\}/)
  assert.match(src, /page-excalidraw-expand/)
  assert.match(src, /replace: true/)
  assert.match(src, /pointerOnly/)
  assert.match(src, /defaults: \(\) => \(\{ file:/)
  assert.match(src, /createPortal/)
  assert.match(src, /theme="light"/)
  assert.match(src, /refresh/)
  assert.match(src, /page-excalidraw-expanded/)
})
