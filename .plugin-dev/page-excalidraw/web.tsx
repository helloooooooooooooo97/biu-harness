import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useRef, useState } from 'react'

type Ctx = {
  inject: (name: string) => unknown
}

type PageEditor = {
  registerBlock: (spec: {
    kind: string
    label: string
    defaults?: () => Record<string, unknown>
    view: (props: { data: Record<string, unknown>; update: (p: Record<string, unknown>) => void }) => unknown
  }) => void
}

type Scene = {
  elements?: unknown[]
  appState?: Record<string, unknown>
  files?: Record<string, unknown>
}

function emptyScene(): Scene {
  return { elements: [], appState: { viewBackgroundColor: '#ffffff' }, files: {} }
}

function parseScene(raw: unknown): Scene {
  if (!raw || typeof raw !== 'object') return emptyScene()
  const o = raw as Scene
  return {
    elements: Array.isArray(o.elements) ? o.elements : [],
    appState: o.appState && typeof o.appState === 'object' ? o.appState : { viewBackgroundColor: '#ffffff' },
    files: o.files && typeof o.files === 'object' ? o.files : {},
  }
}

function assetName(file: string) {
  return file.replace(/^assets\//, '')
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

const UI_OPTIONS = { canvasActions: { loadScene: false, saveToActiveFile: false } } as const

function Board(props: { data: Record<string, unknown>; update: (p: Record<string, unknown>) => void }) {
  const file = String(props.data.file || '')
  const [scene, setScene] = useState<Scene | null>(null)
  const [expanded, setExpanded] = useState(false)
  const apiRef = useRef<{ refresh: () => void } | null>(null)
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSaved = useRef('')
  const live = useRef<Scene | null>(null)

  const bindApi = useCallback((api: { refresh: () => void } | null) => {
    apiRef.current = api
  }, [])

  useEffect(() => {
    if (!file) {
      props.update({ file: `assets/excalidraw-${crypto.randomUUID()}.json` })
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
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false)
    }
    window.addEventListener('keydown', onKey)
    const id = requestAnimationFrame(() => apiRef.current?.refresh())
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

  if (!file) return <div className="text-sm text-[var(--muted-foreground)]">正在创建画板文件…</div>
  if (!scene) return <div className="text-sm text-[var(--muted-foreground)]">正在加载画板…</div>

  const start = live.current || scene
  const canvas = (
    <div
      className={expanded ? 'h-full w-full' : 'pointer-events-none h-full w-full'}
      style={{ height: '100%', width: '100%' }}
    >
      <Excalidraw
        initialData={{
          elements: start.elements as never,
          appState: { ...start.appState, collaborators: new Map() },
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
    <div className="overflow-hidden rounded-md border border-[var(--border)] bg-[var(--background)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-2 py-1 text-xs text-[var(--muted-foreground)]">
        <span>画板</span>
        <button
          type="button"
          className="rounded px-2 py-0.5 hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? '缩小' : '放大'}
        </button>
      </div>
      <div className="h-[280px]">{expanded ? null : canvas}</div>
      {expanded
        ? createPortal(
            <div className="fixed inset-0 z-[80] flex flex-col bg-[var(--background)]">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2 text-sm">
                <span>画板</span>
                <button type="button" className="rounded px-2 py-1 hover:bg-[var(--muted)]" onClick={() => setExpanded(false)}>
                  缩小
                </button>
              </div>
              <div className="min-h-0 flex-1">{canvas}</div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

export default function apply(ctx: Ctx) {
  const pageEditor = ctx.inject('pageEditor') as PageEditor | undefined
  pageEditor?.registerBlock({
    kind: 'excalidraw',
    label: '画板',
    defaults: () => ({ file: `assets/excalidraw-${crypto.randomUUID()}.json` }),
    view: (props) => <Board data={props.data} update={props.update} />,
  })
}
