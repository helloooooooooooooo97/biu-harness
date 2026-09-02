import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useRef, useState } from 'react'

export const name = 'page-excalidraw'
export const inject = ['pageEditor']

type PageEditor = {
  registerBlock: (spec: {
    kind: string
    label: string
    hint?: string
    aliases?: string[]
    defaults?: () => Record<string, unknown>
    View: (props: { data: Record<string, unknown>; update: (p: Record<string, unknown>) => void; writable: boolean }) => unknown
  }) => void
}

type Scene = {
  elements?: unknown[]
  appState?: Record<string, unknown>
  files?: Record<string, unknown>
}

type DrawApi = {
  refresh: () => void
  scrollToContent?: (target?: unknown, opts?: { fitToContent?: boolean; animate?: boolean }) => void
  updateScene?: (opts: { appState?: Record<string, unknown> }) => void
}

function appCanvasColor() {
  const fromCss =
    typeof document === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue('--dsw-bg').trim()
  return fromCss || '#191919'
}

function parseRgb(color: unknown): [number, number, number] | null {
  const value = String(color ?? '').trim().toLowerCase()
  if (!value) return null
  if (value === 'white') return [255, 255, 255]
  if (value === 'black') return [0, 0, 0]
  const hex = value.startsWith('#') ? value.slice(1) : ''
  if (/^[0-9a-f]{3}$/.test(hex)) {
    return [parseInt(hex[0] + hex[0], 16), parseInt(hex[1] + hex[1], 16), parseInt(hex[2] + hex[2], 16)]
  }
  if (/^[0-9a-f]{6}$/.test(hex)) {
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]
  }
  const rgb = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
  return null
}

function isLightCanvas(color: unknown) {
  const rgb = parseRgb(color)
  if (!rgb) return !String(color ?? '').trim()
  const [r, g, b] = rgb.map((channel) => channel / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45
}

function isStockLight(color: unknown) {
  const value = String(color ?? '').trim().toLowerCase()
  return value === '#d8d8d8' || value === '#ffffff' || value === '#fff' || value === 'white'
}

function resolveCanvas(color: unknown, empty: boolean) {
  if (!String(color ?? '').trim() || isStockLight(color) || (empty && isLightCanvas(color))) return appCanvasColor()
  return String(color)
}

function emptyScene(): Scene {
  return { elements: [], appState: { theme: 'dark', viewBackgroundColor: appCanvasColor() }, files: {} }
}

function parseScene(raw: unknown): Scene {
  if (!raw || typeof raw !== 'object') return emptyScene()
  const o = raw as Scene
  const appState = o.appState && typeof o.appState === 'object' ? { ...o.appState } : {}
  const elements = Array.isArray(o.elements) ? o.elements : []
  appState.theme = 'dark'
  appState.viewBackgroundColor = resolveCanvas(appState.viewBackgroundColor, elements.length === 0)
  return {
    elements,
    appState,
    files: o.files && typeof o.files === 'object' ? o.files : {},
  }
}

function assetName(file: string) {
  return file.replace(/^assets\//, '')
}

function assetStem(file: string) {
  return assetName(file).replace(/\.[^.]+$/, '')
}

function normalizeStem(raw: string, fallback: string) {
  const trimmed = raw.trim() || fallback
  const stem = trimmed.replace(/\.[^.]+$/, '')
  if (!stem || /[\\/]/.test(stem) || !/^[\p{L}\p{N}._-]+$/u.test(stem)) return fallback
  return stem
}

async function loadScene(file: string): Promise<Scene> {
  const name = assetName(file)
  const res = await fetch(`/api/page/file/${encodeURIComponent(name)}`)
  if (res.status === 404) {
    const scene = emptyScene()
    await fetch(`/api/page/file/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scene),
    })
    return scene
  }
  if (!res.ok) return emptyScene()
  try {
    return parseScene(JSON.parse(await res.text()))
  } catch {
    return emptyScene()
  }
}

function saveScene(file: string, scene: Scene) {
  const name = assetName(file)
  void fetch(`/api/page/file/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scene),
  })
}

function fitView(api: DrawApi | null) {
  if (!api) return
  api.refresh?.()
  api.scrollToContent?.(undefined, { fitToContent: true, animate: false })
}

const UI_OPTIONS = { canvasActions: { loadScene: false, saveToActiveFile: false } } as const

function BoardBar(props: {
  file: string
  expanded: boolean
  writable: boolean
  onToggle: () => void
  onRename: (name: string) => void
}) {
  const [draft, setDraft] = useState(assetStem(props.file))
  useEffect(() => {
    setDraft(assetStem(props.file))
  }, [props.file])

  const commit = () => {
    const next = normalizeStem(draft, assetStem(props.file))
    setDraft(next)
    if (next === assetStem(props.file)) return
    props.onRename(`${next}.json`)
  }

  return (
    <div className="flex items-center gap-2 px-1 py-1 text-xs text-[var(--muted-foreground)]">
      <span className="shrink-0">画板</span>
      <input
        data-page-block-capture=""
        className="min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 text-center text-[var(--foreground)] outline-none hover:bg-[var(--muted)] focus:bg-[var(--muted)]"
        value={draft}
        disabled={!props.writable}
        aria-label="画板名称"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            ;(event.target as HTMLInputElement).blur()
          }
        }}
      />
      <button
        type="button"
        className="shrink-0 rounded px-2 py-0.5 hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
        onClick={props.onToggle}
      >
        {props.expanded ? '缩小' : '放大'}
      </button>
    </div>
  )
}

function Board(props: { data: Record<string, unknown>; update: (p: Record<string, unknown>) => void; writable: boolean }) {
  const file = String(props.data.file || '')
  const [scene, setScene] = useState<Scene | null>(null)
  const [expanded, setExpanded] = useState(false)
  const apiRef = useRef<DrawApi | null>(null)
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSaved = useRef('')
  const live = useRef<Scene | null>(null)
  const boot = useRef(true)
  const expandedRef = useRef(expanded)
  expandedRef.current = expanded

  const bindApi = useCallback((api: DrawApi | null) => {
    apiRef.current = api
    if (!api) return
    requestAnimationFrame(() => {
      if (apiRef.current !== api) return
      const current = live.current
      const empty = !(current?.elements && current.elements.length)
      if (api.updateScene && (empty || isLightCanvas(current?.appState?.viewBackgroundColor))) {
        api.updateScene({ appState: { theme: 'dark', viewBackgroundColor: appCanvasColor() } })
      }
      fitView(api)
    })
  }, [])

  useEffect(() => {
    if (!file) {
      props.update({ file: `assets/画板-${crypto.randomUUID().slice(0, 8)}.json` })
      return
    }
    let gone = false
    void loadScene(file).then((next) => {
      if (gone) return
      lastSaved.current = JSON.stringify(next)
      live.current = next
      boot.current = true
      setScene(next)
    })
    return () => {
      gone = true
    }
  }, [file])

  useEffect(() => {
    if (!expanded) {
      const id = requestAnimationFrame(() => fitView(apiRef.current))
      return () => cancelAnimationFrame(id)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false)
    }
    window.addEventListener('keydown', onKey)
    const id = requestAnimationFrame(() => fitView(apiRef.current))
    return () => {
      window.removeEventListener('keydown', onKey)
      cancelAnimationFrame(id)
    }
  }, [expanded])

  const onChange = useCallback((elements: unknown[], appState: Record<string, unknown>, files: Record<string, unknown>) => {
    if (!file) return
    const forceAppCanvas = boot.current
    boot.current = false
    const next: Scene = {
      elements,
      appState: {
        ...appState,
        collaborators: undefined,
        theme: 'dark',
        viewBackgroundColor: resolveCanvas(
          appState.viewBackgroundColor,
          forceAppCanvas || !elements.length,
        ),
      },
      files,
    }
    live.current = next
    const raw = JSON.stringify(next)
    if (raw === lastSaved.current) return
    lastSaved.current = raw
    if (pending.current) clearTimeout(pending.current)
    pending.current = setTimeout(() => saveScene(file, next), 400)
  }, [file])

  const onRename = (name: string) => {
    const nextFile = `assets/${name}`
    const current = live.current
    if (current) saveScene(nextFile, current)
    props.update({ file: nextFile })
  }

  if (!file) return <div className="text-sm text-[var(--muted-foreground)]">正在创建画板文件…</div>
  if (!scene) return <div className="text-sm text-[var(--muted-foreground)]">正在加载画板…</div>

  const start = live.current || scene
  const canvas = (
    <div
      className={expanded ? 'h-full w-full' : 'pointer-events-none h-full w-full'}
      style={{ height: '100%', width: '100%', isolation: 'isolate', overflow: 'hidden' }}
    >
      <Excalidraw
        theme="dark"
        initialData={{
          elements: start.elements as never,
          appState: {
            ...start.appState,
            theme: 'dark',
            viewBackgroundColor: resolveCanvas(
              start.appState?.viewBackgroundColor,
              !(start.elements && start.elements.length),
            ),
            collaborators: new Map(),
          },
          files: start.files as never,
        }}
        viewModeEnabled={!expanded}
        zenModeEnabled={!expanded}
        UIOptions={UI_OPTIONS as never}
        onChange={onChange as never}
        excalidrawAPI={bindApi as never}
      />
    </div>
  )

  return (
    <div className="overflow-hidden bg-transparent">
      <BoardBar
        file={file}
        expanded={expanded}
        writable={props.writable}
        onToggle={() => setExpanded((v) => !v)}
        onRename={onRename}
      />
      <div className="h-[280px]">{expanded ? null : canvas}</div>
      {expanded
        ? createPortal(
            <div className="fixed inset-0 flex flex-col bg-[var(--dsw-bg,#191919)]" style={{ zIndex: 9990 }}>
              <BoardBar
                file={file}
                expanded={expanded}
                writable={props.writable}
                onToggle={() => setExpanded(false)}
                onRename={onRename}
              />
              <div className="min-h-0 flex-1">{canvas}</div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

export function apply(ctx: { pageEditor: PageEditor }) {
  ctx.pageEditor.registerBlock({
    kind: 'excalidraw',
    label: '画板',
    hint: '手绘白板，放大后编辑',
    aliases: ['excalidraw', 'draw', '白板', '画板', 'board'],
    defaults: () => ({ file: `assets/画板-${crypto.randomUUID().slice(0, 8)}.json` }),
    View: Board,
  })
}
