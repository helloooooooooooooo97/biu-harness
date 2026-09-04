import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'

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

function emptyScene(): Scene {
  return { elements: [], appState: { theme: 'dark' }, files: {} }
}

function withoutCollab(appState: unknown): Record<string, unknown> {
  if (!appState || typeof appState !== 'object' || Array.isArray(appState)) return {}
  const { collaborators: _c, ...rest } = appState as Record<string, unknown>
  return rest
}

function parseScene(raw: unknown): Scene {
  if (!raw || typeof raw !== 'object') return emptyScene()
  const o = raw as Scene
  return {
    elements: Array.isArray(o.elements) ? o.elements : [],
    appState: withoutCollab(o.appState),
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

const BAR: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  height: 36,
  padding: '0 8px',
  background: 'var(--dsw-sidebar)',
  borderBottom: '1px solid var(--dsw-border)',
  color: 'var(--dsw-label-2)',
  fontSize: 12,
}

const ICON_BTN: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 'none',
  width: 28,
  height: 28,
  margin: 0,
  padding: 0,
  border: 0,
  borderRadius: 8,
  background: 'transparent',
  color: 'var(--dsw-label-2)',
  cursor: 'pointer',
}

function Glyph(props: { d: string; evenodd?: boolean }) {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d={props.d} fillRule={props.evenodd ? 'evenodd' : undefined} clipRule={props.evenodd ? 'evenodd' : undefined} />
    </svg>
  )
}

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
    <div style={BAR}>
      <span style={{ display: 'inline-flex', color: 'var(--dsw-label)' }} title="画板">
        <Glyph
          evenodd
          d="M2 12V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2Zm1.5-5.5V12a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5V6.5A.5.5 0 0 0 12 6H4a.5.5 0 0 0-.5.5Zm.75-1.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM7 4a.75.75 0 1 1-1.5 0A.75.75 0 0 1 7 4Zm1.25.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
        />
      </span>
      <input
        data-page-block-capture=""
        style={{
          minWidth: 0,
          flex: 1,
          height: 28,
          margin: 0,
          border: 0,
          borderRadius: 8,
          padding: '0 8px',
          background: 'transparent',
          color: 'var(--dsw-label)',
          font: 'inherit',
          textAlign: 'center',
          outline: 'none',
        }}
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
        style={ICON_BTN}
        title={props.expanded ? '缩小' : '放大'}
        aria-label={props.expanded ? '缩小' : '放大'}
        onClick={props.onToggle}
      >
        {props.expanded ? (
          <Glyph
            evenodd
            d="M2.22 2.22a.75.75 0 0 1 1.06 0L5.5 4.44V2.75a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-.75.75h-3.5a.75.75 0 0 1 0-1.5h1.69L2.22 3.28a.75.75 0 0 1 0-1.06Zm10.5 0a.75.75 0 1 1 1.06 1.06L11.56 5.5h1.69a.75.75 0 0 1 0 1.5h-3.5A.75.75 0 0 1 9 6.25v-3.5a.75.75 0 0 1 1.5 0v1.69l2.22-2.22ZM2.75 9h3.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-1.69l-2.22 2.22a.75.75 0 0 1-1.06-1.06l2.22-2.22H2.75a.75.75 0 0 1 0-1.5ZM9 9.75A.75.75 0 0 1 9.75 9h3.5a.75.75 0 0 1 0 1.5h-1.69l2.22 2.22a.75.75 0 1 1-1.06 1.06l-2.22-2.22v1.69a.75.75 0 0 1-1.5 0v-3.5Z"
          />
        ) : (
          <Glyph
            evenodd
            d="M2.75 9a.75.75 0 0 1 .75.75v1.69l2.22-2.22a.75.75 0 0 1 1.06 1.06L4.56 12.5h1.69a.75.75 0 0 1 0 1.5h-3.5a.75.75 0 0 1-.75-.75v-3.5A.75.75 0 0 1 2.75 9ZM2.75 7a.75.75 0 0 0 .75-.75V4.56l2.22 2.22a.75.75 0 0 0 1.06-1.06L4.56 3.5h1.69a.75.75 0 0 0 0-1.5h-3.5a.75.75 0 0 0-.75.75v3.5c0 .414.336.75.75.75ZM13.25 9a.75.75 0 0 0-.75.75v1.69l-2.22-2.22a.75.75 0 1 0-1.06 1.06l2.22 2.22H9.75a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 .75-.75v-3.5a.75.75 0 0 0-.75-.75ZM13.25 7a.75.75 0 0 1-.75-.75V4.56l-2.22 2.22a.75.75 0 1 1-1.06-1.06l2.22-2.22H9.75a.75.75 0 0 1 0-1.5h3.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-.75.75Z"
          />
        )}
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
    if (!expanded) return
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
      appState: withoutCollab(appState),
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
    <div style={{ overflow: 'hidden', background: 'var(--dsw-bg)', borderRadius: 8 }}>
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
