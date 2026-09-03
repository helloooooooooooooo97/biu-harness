import { useEffect, useState } from 'react'
import {
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  DocumentIcon,
  PuzzlePieceIcon,
  TagIcon,
  MapIcon,
  SignalIcon,
} from '@heroicons/react/16/solid'
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

/** 检查器工具仍注册到 dock 服务，供插件窗口等内部调用；底部 dock UI 已去掉。 */
export function ShellDockNav({
  dock,
  activeId,
  inspectorOpen,
  sessionId,
  collections,
}: {
  dock: DockService
  activeId: string
  inspectorOpen: boolean
  sessionId: string | null
  collections?: Array<{ path: string }>
}) {
  const [opened, setOpened] = useState(() => readInspectorOpened(sessionId))

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

  return null
}
