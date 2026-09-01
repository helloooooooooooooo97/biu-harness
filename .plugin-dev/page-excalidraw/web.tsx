import { useEffect, useMemo, useRef, useState } from 'react'
import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'

export const name = 'page-excalidraw'
export const inject = ['pageEditor']

const DEFAULTS = {
  elements: [] as unknown[],
  files: {} as Record<string, unknown>,
  height: 420,
  zoom: 1,
}

function asZoom(value: number) {
  return Math.min(3, Math.max(0.25, Math.round(value * 100) / 100)) as number & { _brand: 'zoom' }
}

function asHeight(value: number) {
  return Math.min(900, Math.max(220, Math.round(value)))
}

function slimAppState(appState: Record<string, unknown> | undefined, zoom: number) {
  const state = appState ?? {}
  return {
    viewBackgroundColor: state.viewBackgroundColor ?? '#ffffff',
    zoom: { value: asZoom(Number((state.zoom as { value?: number } | undefined)?.value ?? zoom) || 1) },
    scrollX: Number(state.scrollX ?? 0),
    scrollY: Number(state.scrollY ?? 0),
  }
}

function Board({
  data,
  update,
  writable,
}: {
  data: Record<string, unknown>
  update: (patch: Record<string, unknown>) => void
  writable: boolean
}) {
  const api = useRef<{
    updateScene: (scene: { appState?: Record<string, unknown> }) => void
    scrollToContent: (arg?: unknown, opts?: { fitToContent?: boolean }) => void
    getAppState: () => { zoom?: { value?: number } }
  } | null>(null)
  const height = asHeight(Number(data.height ?? DEFAULTS.height))
  const zoom = asZoom(Number(data.zoom ?? DEFAULTS.zoom) || 1)
  const [liveZoom, setLiveZoom] = useState(zoom)
  const persist = useRef(update)
  persist.current = update
  const saveTimer = useRef<number | undefined>(undefined)

  const initialData = useMemo(
    () => ({
      elements: Array.isArray(data.elements) ? data.elements : [],
      files: data.files && typeof data.files === 'object' ? data.files : {},
      appState: slimAppState(data.appState as Record<string, unknown> | undefined, zoom),
      scrollToContent: true,
    }),
    [],
  )

  useEffect(
    () => () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    },
    [],
  )

  function setBoardZoom(next: number) {
    const value = asZoom(next)
    setLiveZoom(value)
    api.current?.updateScene({ appState: { zoom: { value } } })
    persist.current({ zoom: value })
  }

  return (
    <div
      data-testid="page-excalidraw"
      data-page-block-capture="1"
      style={{
        border: '1px solid #d0d7de',
        borderRadius: 12,
        overflow: 'hidden',
        background: '#fff',
      }}
    >
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
        <span data-testid="page-excalidraw-zoom">{Math.round(liveZoom * 100)}%</span>
        <button type="button" data-testid="page-excalidraw-zoom-out" onClick={() => setBoardZoom(liveZoom - 0.15)}>
          缩小
        </button>
        <button type="button" data-testid="page-excalidraw-zoom-in" onClick={() => setBoardZoom(liveZoom + 0.15)}>
          放大
        </button>
        <button
          type="button"
          data-testid="page-excalidraw-fit"
          onClick={() => api.current?.scrollToContent(undefined, { fitToContent: true })}
        >
          适应
        </button>
        <span style={{ marginLeft: 'auto' }}>高度 {height}px</span>
        <button type="button" data-testid="page-excalidraw-shorter" onClick={() => persist.current({ height: asHeight(height - 80) })}>
          更矮
        </button>
        <button type="button" data-testid="page-excalidraw-taller" onClick={() => persist.current({ height: asHeight(height + 80) })}>
          更高
        </button>
      </div>
      <div style={{ height, position: 'relative' }}>
        <Excalidraw
          langCode="zh-CN"
          viewModeEnabled={!writable}
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
            if (!writable) return
            const nextZoom = asZoom(Number(appState.zoom?.value ?? liveZoom) || 1)
            setLiveZoom(nextZoom)
            if (saveTimer.current) window.clearTimeout(saveTimer.current)
            saveTimer.current = window.setTimeout(() => {
              persist.current({
                elements,
                files,
                zoom: nextZoom,
                appState: slimAppState(appState as unknown as Record<string, unknown>, nextZoom),
              })
            }, 280)
          }}
        />
      </div>
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
      defaults?: Record<string, unknown>
      View: (props: { data: Record<string, unknown>; update: (patch: Record<string, unknown>) => void; writable: boolean }) => unknown
    }) => void
  }
}) {
  ctx.pageEditor.registerBlock({
    kind: 'excalidraw',
    label: '画板',
    hint: 'Excalidraw，可放大缩小',
    aliases: ['excalidraw', 'draw', 'whiteboard', '白板', '画图', 'sketch'],
    defaults: DEFAULTS,
    View: Board,
  })
}
