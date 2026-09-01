import { useEffect, useMemo, useRef, useState } from 'react'
import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'

export const name = 'page-excalidraw'
export const inject = ['pageEditor']

type Scene = {
  elements: unknown[]
  files: Record<string, unknown>
  appState: Record<string, unknown>
  height: number
}

const EMPTY_SCENE: Scene = {
  elements: [],
  files: {},
  appState: { viewBackgroundColor: '#ffffff', zoom: { value: 1 } },
  height: 280,
}

function assetName(file: unknown) {
  const raw = String(file ?? '').trim()
  if (!raw) return ''
  const cleaned = raw.replace(/^\/+/, '')
  if (cleaned.startsWith('assets/')) return cleaned.slice('assets/'.length)
  if (cleaned.startsWith('/api/page/file/')) {
    return decodeURIComponent(cleaned.slice('/api/page/file/'.length).split(/[?#]/)[0] ?? '')
  }
  if (!cleaned.includes('/')) return cleaned
  return ''
}

function assetPath(name: string) {
  return `/api/page/file/${encodeURIComponent(name)}`
}

function asHeight(value: number) {
  return Math.min(900, Math.max(180, Math.round(value) || 280))
}

function slimAppState(appState: Record<string, unknown> | undefined) {
  const state = appState ?? {}
  return {
    viewBackgroundColor: state.viewBackgroundColor ?? '#ffffff',
    zoom: state.zoom ?? { value: 1 },
    scrollX: Number(state.scrollX ?? 0),
    scrollY: Number(state.scrollY ?? 0),
  }
}

function sceneFrom(raw: Partial<Scene> | Record<string, unknown> | null | undefined, fallbackHeight = 280): Scene {
  const rec = raw && typeof raw === 'object' ? raw : {}
  return {
    elements: Array.isArray((rec as Scene).elements) ? (rec as Scene).elements : [],
    files: (rec as Scene).files && typeof (rec as Scene).files === 'object' ? (rec as Scene).files : {},
    appState: slimAppState((rec as Scene).appState),
    height: asHeight(Number((rec as Scene).height ?? fallbackHeight)),
  }
}

async function readScene(name: string): Promise<Scene> {
  const res = await fetch(assetPath(name))
  if (!res.ok) return EMPTY_SCENE
  return sceneFrom((await res.json()) as Partial<Scene>)
}

async function writeScene(name: string, scene: Scene) {
  await fetch(assetPath(name), {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      elements: scene.elements,
      files: scene.files,
      appState: slimAppState(scene.appState),
      height: scene.height,
    }),
  })
}

function pointerOnly(file: string) {
  return { file: `assets/${file}` }
}

function Board({
  data,
  update,
  writable,
}: {
  data: Record<string, unknown>
  update: (patch: Record<string, unknown>, opts?: { replace?: boolean }) => void
  writable: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [scene, setScene] = useState<Scene | null>(null)
  const [file, setFile] = useState(() => assetName(data.file))
  const persist = useRef(update)
  persist.current = update
  const saveTimer = useRef<number | undefined>(undefined)
  const api = useRef<{
    updateScene: (scene: { appState?: Record<string, unknown> }) => void
    scrollToContent: (arg?: unknown, opts?: { fitToContent?: boolean }) => void
  } | null>(null)

  useEffect(() => {
    let name = assetName(data.file)
    const leftover = sceneFrom(data, Number(data.height) || 280)
    if (!name) {
      name = `excalidraw-${crypto.randomUUID()}.json`
      setFile(name)
      persist.current(pointerOnly(name), { replace: true })
      void writeScene(name, leftover).then(() => setScene(leftover))
      return
    }
    setFile(name)
    const extra = Object.keys(data).some((key) => key !== 'file')
    if (extra) persist.current(pointerOnly(name), { replace: true })
    let cancelled = false
    void readScene(name).then((next) => {
      if (cancelled) return
      const merged =
        leftover.elements.length && next.elements.length === 0
          ? { ...next, elements: leftover.elements, files: leftover.files, appState: leftover.appState }
          : next
      setScene(merged)
      if (merged !== next) void writeScene(name, merged)
    })
    return () => {
      cancelled = true
    }
  }, [data.file])

  useEffect(
    () => () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    },
    [],
  )

  useEffect(() => {
    if (!expanded) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded])

  const initialData = useMemo(() => {
    if (!scene) return null
    return {
      elements: scene.elements,
      files: scene.files,
      appState: scene.appState,
      scrollToContent: true,
    }
  }, [scene, expanded])

  const canEdit = expanded && writable
  const height = asHeight(scene?.height ?? 280)

  function saveSoon(next: Scene) {
    if (!file || !canEdit) return
    setScene(next)
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      void writeScene(file, next)
    }, 280)
  }

  function setHeight(next: number) {
    if (!file || !scene) return
    const updated = { ...scene, height: asHeight(next) }
    setScene(updated)
    void writeScene(file, updated)
  }

  const frame = (
    <div style={{ height: expanded ? 'calc(100vh - 48px)' : height, position: 'relative', minHeight: 180 }}>
      {initialData ? (
        <Excalidraw
          key={expanded ? 'expanded' : 'preview'}
          langCode="zh-CN"
          viewModeEnabled={!canEdit}
          zenModeEnabled={false}
          gridModeEnabled={false}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              saveToActiveFile: false,
              toggleTheme: false,
              export: false,
            },
          }}
          initialData={initialData as never}
          excalidrawAPI={(next) => {
            api.current = next as typeof api.current
          }}
          onChange={(elements, appState, files) => {
            saveSoon({
              elements: [...elements],
              files: files as Record<string, unknown>,
              appState: slimAppState(appState as unknown as Record<string, unknown>),
              height,
            })
          }}
        />
      ) : (
        <div style={{ padding: 24, color: '#6b7280', font: '13px ui-sans-serif, system-ui, sans-serif' }}>加载画板…</div>
      )}
    </div>
  )

  const toolbar = (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px',
        borderBottom: '1px solid #e5e7eb',
        font: '12px/1.4 ui-sans-serif, system-ui, sans-serif',
        color: '#4b5563',
      }}
    >
      <span style={{ fontWeight: 700, color: '#111827' }}>画板</span>
      {expanded ? (
        <>
          <button type="button" data-testid="page-excalidraw-fit" onClick={() => api.current?.scrollToContent(undefined, { fitToContent: true })}>
            适应
          </button>
          <button type="button" data-testid="page-excalidraw-collapse" onClick={() => setExpanded(false)} style={{ marginLeft: 'auto' }}>
            缩小
          </button>
        </>
      ) : (
        <>
          <span style={{ marginLeft: 'auto' }}>高度 {height}px</span>
          <button type="button" data-testid="page-excalidraw-shorter" onClick={() => setHeight(height - 80)}>
            更矮
          </button>
          <button type="button" data-testid="page-excalidraw-taller" onClick={() => setHeight(height + 80)}>
            更高
          </button>
          <button type="button" data-testid="page-excalidraw-expand" onClick={() => setExpanded(true)}>
            放大
          </button>
        </>
      )}
    </div>
  )

  return (
    <div
      data-testid="page-excalidraw"
      data-page-block-capture="1"
      data-expanded={expanded ? '1' : '0'}
      data-file={file || undefined}
      style={{
        border: '1px solid #d0d7de',
        borderRadius: expanded ? 0 : 12,
        overflow: 'hidden',
        background: '#fff',
        ...(expanded ? { position: 'fixed', inset: 0, zIndex: 400, borderRadius: 0 } : {}),
      }}
    >
      {toolbar}
      {frame}
      {!expanded ? (
        <p style={{ margin: 0, padding: '6px 10px 10px', font: '12px ui-sans-serif, system-ui, sans-serif', color: '#6b7280' }}>
          {writable ? '预览不可画。点「放大」后才能编辑。' : '只读预览。'}
        </p>
      ) : null}
    </div>
  )
}

export function apply(ctx: {
  pageEditor: {
    registerBlock: (spec: {
      kind: string
      label: string
      hint?: string
      aliases?: string[]
      defaults?: Record<string, unknown> | (() => Record<string, unknown>)
      View: (props: {
        data: Record<string, unknown>
        update: (patch: Record<string, unknown>, opts?: { replace?: boolean }) => void
        writable: boolean
      }) => unknown
    }) => void
  }
}) {
  ctx.pageEditor.registerBlock({
    kind: 'excalidraw',
    label: '画板',
    hint: '场景在 .page/assets，正文只留 file 引用；放大后才能画',
    aliases: ['excalidraw', 'draw', 'whiteboard', '白板', '画图', 'sketch'],
    defaults: () => ({ file: `assets/excalidraw-${crypto.randomUUID()}.json` }),
    View: Board,
  })
}
