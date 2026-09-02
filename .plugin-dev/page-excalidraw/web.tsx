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
}

const DARK_BG = '#121212'

function emptyScene(): Scene {
  return { elements: [], appState: { theme: 'dark', viewBackgroundColor: DARK_BG }, files: {} }
}

function parseScene(raw: unknown): Scene {
  if (!raw || typeof raw !== 'object') return emptyScene()
  const o = raw as Scene
  const appState = o.appState && typeof o.appState === 'object' ? { ...o.appState } : {}
  if (!appState.theme) appState.theme = 'dark'
  if (!appState.viewBackgroundColor) appState.viewBackgroundColor = DARK_BG
  return {
    elements: Array.isArray(o.elements) ? o.elements : [],
    appState,
    files: o.files && typeof o.files === 'object' ? o.files : {},
  }
}

function assetName(file: string) {
  return file.replace(/^assets\//, '')
}

function validAssetFile(name: string) {
  return name === name.replace(/[\\/]/g, '') && /^[\p{L}\p{N}._-]+$/u.test(name)
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
  const [draft, setDraft] = useState(assetName(props.file))
  useEffect(() => {
    setDraft(assetName(props.file))
  }, [props.file])

  const commit = () => {
    let next = draft.trim() || assetName(props.file)
    if (!next.includes('.')) next = `${next}.json`
    if (!validAssetFile(next) || next === assetName(props.file)) {
      setDraft(assetName(props.file))
      return
    }
    props.onRename(next)
  }

  return (
    <div className="flex items-center gap-2 px-1 py-1 text-xs text-[var(--muted-foreground)]">
      <span className="shrink-0">画板</span>
      <input
        data-page-block-capture=""
        className="min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 text-center text-[var(--foreground)] outline-none hover:bg-[var(--muted)] focus:bg-[var(--muted)]"
        value={draft}
        disabled={!props.writable}
        aria-label="画板文件名"
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
  const expandedRef = useRef(expanded)
  expandedRef.current = expanded

  const bindApi = useCallback((api: DrawApi | null) => {
    apiRef.current = api
    requestAnimationFrame(() => fitView(api))
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
    const next: Scene = {
      elements,
      appState: { ...appState, collaborators: undefined },
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
          appState: { ...start.appState, theme: 'dark', collaborators: new Map() },
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
            <div className="fixed inset-0 flex flex-col bg-[#121212]" style={{ zIndex: 9990 }}>
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
