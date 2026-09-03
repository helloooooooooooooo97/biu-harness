import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDownTrayIcon,
  ChatBubbleLeftIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  Cog6ToothIcon,
  DocumentIcon,
  PuzzlePieceIcon,
  TagIcon,
  MapIcon,
  SignalIcon,
} from '@heroicons/react/16/solid'
import type { AppModule } from '@biu/web-app-modules'
import type { DockService } from '@biu/core-dock'
import { requestInspectorOpen, requestInspectorTab, setChatOverlay } from './chat-overlay.ts'
import {
  inspectorTabCollectionPath,
  inspectorTabIsOpen,
  pruneOpenedForCollections,
} from './inspector-panels.ts'

const INSPECTOR_DOCK_TOOLS = [
  { id: 'inspector:pages', title: '页面', tabId: 'database:/pages', order: 40, Icon: DocumentIcon },
  { id: 'inspector:sessions', title: '会话', tabId: 'database:/sessions', order: 41, Icon: ChatBubbleLeftRightIcon },
  { id: 'inspector:tasks', title: '任务', tabId: 'database:/tasks', order: 42, Icon: CheckCircleIcon },
  { id: 'inspector:plugins', title: '插件', tabId: 'database:/plugins', order: 43, Icon: PuzzlePieceIcon },
  { id: 'inspector:facets', title: '类型', tabId: 'database:/facets', order: 44, Icon: TagIcon },
  { id: 'inspector:traj', title: '轨迹', tabId: 'traj', order: 45, Icon: MapIcon },
  { id: 'inspector:usage', title: '用量', tabId: 'usage', order: 46, Icon: SignalIcon },
] as const

function DockModuleIcon({ module }: { module: AppModule }) {
  if (module.Icon) {
    const Icon = module.Icon
    return <Icon className="size-5" />
  }
  if (module.id === 'agent') return <ChatBubbleLeftIcon className="size-5" aria-hidden />
  return <PuzzlePieceIcon className="size-5" aria-hidden />
}

function ShellDockUpdate({ dock }: { dock: DockService }) {
  const [behind, setBehind] = useState(0)
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState<string | undefined>()

  useEffect(() => {
    void fetch('/api/update')
      .then((res) => res.json() as Promise<{ behind?: number }>)
      .then((data) => setBehind(Math.max(0, Number(data.behind) || 0)))
      .catch(() => { })
  }, [])

  useEffect(() => {
    if (!hint || behind > 0 || busy) return
    const timer = window.setTimeout(() => setHint(undefined), 3200)
    return () => window.clearTimeout(timer)
  }, [hint, behind, busy])

  const download = useCallback(async () => {
    if (busy) return
    if (behind <= 0) {
      setHint('相对于主分支暂时无最新提交版本')
      return
    }
    setBusy(true)
    setHint(undefined)
    try {
      const res = await fetch('/api/update', { method: 'POST' })
      const data = (await res.json()) as { error?: string; restarting?: boolean }
      if (!res.ok) throw new Error(data.error || '更新失败')
      setBehind(0)
      setHint('正在重启…')
    } catch (error) {
      setBusy(false)
      setHint(String(error))
    }
  }, [busy, behind])

  const idle = behind <= 0 && !busy
  const label = hint ?? (behind > 0 ? `下载更新 · 落后 ${behind}` : '下载更新')
  const badge = behind > 99 ? '99+' : String(behind)

  useEffect(() => {
    const Icon = () => (
      <>
        <ArrowDownTrayIcon className="size-5" />
        {behind > 0 && !busy ? (
          <span className="os-dock-badge" aria-hidden>
            {badge}
          </span>
        ) : null}
      </>
    )
    return dock.register({
      id: 'update',
      title: label,
      kind: 'tool',
      group: 'tray',
      order: 201,
      Icon,
      onOpen: () => {
        void download()
      },
    })
  }, [dock, behind, busy, badge, label, download])

  if (!(hint && idle)) return null
  return (
    <span className="os-dock-update-toast" role="status">
      {hint}
    </span>
  )
}

function inspectorOpenedKey(sid: string | null | undefined) {
  return sid ? `inspector.opened:${sid}` : 'inspector.opened:home'
}

function readInspectorOpened(sid: string | null | undefined): string[] {
  try {
    const raw = localStorage.getItem(inspectorOpenedKey(sid))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

export function ShellDockNav({
  dock,
  modules,
  activeId,
  agentHref,
  inspectorOpen,
  sessionId,
  collections,
  onSettings,
}: {
  dock: DockService
  modules: AppModule[]
  activeId: string
  agentHref: string
  inspectorOpen: boolean
  sessionId: string | null
  collections?: Array<{ path: string }>
  onSettings: () => void
}) {
  const navigate = useNavigate()
  const moduleKey = modules.map((item) => `${item.id}:${item.path}:${item.order ?? 0}`).join('|')
  const [opened, setOpened] = useState(() => readInspectorOpened(sessionId))

  useEffect(() => {
    const offs = modules.map((mod) => {
      const Icon = () => <DockModuleIcon module={mod} />
      return dock.register({
        id: `module:${mod.id}`,
        title: mod.label,
        kind: 'module',
        group: 'places',
        order: 11 + (mod.order ?? 0),
        Icon,
        onOpen: () => {
          navigate(mod.id === 'agent' ? agentHref : mod.path)
        },
      })
    })
    return () => {
      for (const off of offs) off()
    }
  }, [dock, moduleKey, agentHref, navigate, modules])

  useEffect(() => {
    for (const mod of modules) {
      dock.patch(`module:${mod.id}`, {
        focused: mod.id === activeId,
        running: mod.id === activeId,
      })
    }
  }, [dock, moduleKey, activeId, modules])

  useEffect(() => {
    if (activeId === 'agent') setChatOverlay(false)
  }, [activeId])

  useEffect(() => {
    setOpened(readInspectorOpened(sessionId))
  }, [sessionId])

  useEffect(() => {
    const onOpened = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId?: string | null; opened?: string[] }>).detail
      if (detail && 'sessionId' in detail && detail.sessionId !== sessionId) return
      if (detail?.opened && Array.isArray(detail.opened)) {
        setOpened(detail.opened.filter((item): item is string => typeof item === 'string'))
        return
      }
      setOpened(readInspectorOpened(sessionId))
    }
    window.addEventListener('biu:inspector-opened', onOpened)
    window.addEventListener('storage', onOpened)
    return () => {
      window.removeEventListener('biu:inspector-opened', onOpened)
      window.removeEventListener('storage', onOpened)
    }
  }, [sessionId])

  useEffect(() => {
    const offs = INSPECTOR_DOCK_TOOLS.map((item) => {
      const Icon = item.Icon
      return dock.register({
        id: item.id,
        title: item.title,
        kind: 'tool',
        group: 'tools',
        order: item.order,
        Icon: () => <Icon className="size-5" />,
        onOpen: () => {
          requestInspectorOpen()
          requestInspectorTab(item.tabId)
        },
      })
    })
    return () => {
      for (const off of offs) off()
    }
  }, [dock])

  useEffect(() => {
    const liveOpened = pruneOpenedForCollections(opened, collections)
    for (const item of INSPECTOR_DOCK_TOOLS) {
      const path = inspectorTabCollectionPath(item.tabId)
      const alive = !path || Boolean(collections?.some((row) => row.path === path))
      dock.patch(item.id, {
        visible: collections == null ? true : alive,
        running: Boolean(inspectorOpen && alive && inspectorTabIsOpen(item.tabId, liveOpened)),
        focused: false,
      })
    }
  }, [dock, inspectorOpen, opened, collections])

  useEffect(() => {
    const Icon = () => <Cog6ToothIcon className="size-5" />
    return dock.register({
      id: 'settings',
      title: 'Settings',
      kind: 'tool',
      group: 'tray',
      order: 200,
      Icon,
      onOpen: onSettings,
    })
  }, [dock, onSettings])

  return <ShellDockUpdate dock={dock} />
}
