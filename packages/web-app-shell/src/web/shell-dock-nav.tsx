import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDownTrayIcon,
  ChatBubbleLeftIcon,
  Cog6ToothIcon,
  PuzzlePieceIcon,
} from '@heroicons/react/16/solid'
import type { AppModule } from '@biu/web-app-modules'
import type { DockService } from '@biu/core-dock'

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

export function ShellDockNav({
  dock,
  modules,
  activeId,
  agentHref,
  onSettings,
}: {
  dock: DockService
  modules: AppModule[]
  activeId: string
  agentHref: string
  onSettings: () => void
}) {
  const navigate = useNavigate()
  const moduleKey = modules.map((item) => `${item.id}:${item.path}:${item.order ?? 0}`).join('|')

  useEffect(() => {
    const offs = modules.map((mod) => {
      const Icon = () => <DockModuleIcon module={mod} />
      return dock.register({
        id: `module:${mod.id}`,
        title: mod.label,
        kind: 'module',
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
        running: false,
      })
    }
  }, [dock, moduleKey, activeId, modules])

  useEffect(() => {
    const Icon = () => <Cog6ToothIcon className="size-5" />
    return dock.register({
      id: 'settings',
      title: 'Settings',
      kind: 'tool',
      order: 200,
      Icon,
      onOpen: onSettings,
    })
  }, [dock, onSettings])

  return <ShellDockUpdate dock={dock} />
}
