import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDownTrayIcon,
  BellIcon,
  ChatBubbleLeftIcon,
  CircleStackIcon,
  Cog6ToothIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/16/solid'
import { setChatOverlay } from './chat-overlay.ts'

export function ShellSettingsUpdate() {
  const [behind, setBehind] = useState(0)
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState<string | undefined>()

  useEffect(() => {
    void fetch('/api/update')
      .then((res) => res.json() as Promise<{ behind?: number }>)
      .then((data) => setBehind(Math.max(0, Number(data.behind) || 0)))
      .catch(() => { })
  }, [])

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

  const badge = behind > 99 ? '99+' : String(behind)

  return (
    <section className="shell-settings-update" data-testid="settings-update">
      <p className="shell-settings-update-lead">
        {behind > 0 ? `当前落后主分支 ${badge} 个提交。` : '已与主分支对齐。'}
      </p>
      <button
        type="button"
        className="shell-settings-update-btn"
        data-testid="settings-update-download"
        disabled={busy}
        onClick={() => void download()}
      >
        <ArrowDownTrayIcon className="size-4" />
        {busy ? '更新中…' : '下载更新'}
      </button>
      {hint ? (
        <p className="shell-settings-update-hint" role="status">
          {hint}
        </p>
      ) : null}
    </section>
  )
}

function SideAction({
  title,
  active,
  testId,
  onClick,
  icon,
  children,
}: {
  title: string
  active?: boolean
  testId: string
  onClick: () => void
  icon: ReactNode
  children?: ReactNode
}) {
  return (
    <button
      type="button"
      className={`app-side-actions-item${active ? ' is-active' : ''}`}
      title={title}
      aria-label={title}
      aria-pressed={active}
      data-testid={testId}
      onClick={onClick}
    >
      <span className="app-side-actions-icon" aria-hidden>
        {icon}
      </span>
      <span className="app-side-actions-label">{title}</span>
      {children}
    </button>
  )
}

/** 公共入口：聊天与数据侧栏共用。 */
export function ShellSidePlaces({
  activeId,
  agentHref,
  onSettings,
}: {
  activeId: string
  agentHref: string
  onSettings: () => void
}) {
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)
  const [notifyOpen, setNotifyOpen] = useState(false)
  const [query, setQuery] = useState('')

  return (
    <div className="app-side-actions shell-side-places" role="navigation" aria-label="面板" data-testid="shell-side-places">
      <SideAction
        title="会话"
        active={activeId === 'agent'}
        testId="chrome-chat-panel"
        icon={<ChatBubbleLeftIcon className="size-5 shrink-0" />}
        onClick={() => {
          setChatOverlay(false)
          navigate(agentHref)
        }}
      />
      <SideAction
        title="数据"
        active={activeId === 'database'}
        testId="chrome-data-panel"
        icon={<CircleStackIcon className="size-5 shrink-0" />}
        onClick={() => navigate('/database')}
      />
      <SideAction
        title="搜索"
        active={searchOpen}
        testId="chrome-search"
        icon={<MagnifyingGlassIcon className="size-5 shrink-0" />}
        onClick={() => {
          setNotifyOpen(false)
          setSearchOpen((open) => !open)
        }}
      />
      {searchOpen && typeof document !== 'undefined'
        ? createPortal(
          <div
            className="shell-search-overlay"
            data-testid="shell-search-overlay"
            onClick={() => setSearchOpen(false)}
          >
            <div
              className="shell-search-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="搜索"
              onClick={(event) => event.stopPropagation()}
            >
              <input
                className="shell-chrome-search-input"
                autoFocus
                placeholder="搜索…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setSearchOpen(false)
                }}
              />
              <p className="shell-chrome-pop-empty">输入关键字以搜索会话与数据</p>
            </div>
          </div>,
          document.body,
        )
        : null}
      <div className="shell-side-pop-wrap">
        <SideAction
          title="通知"
          active={notifyOpen}
          testId="chrome-notify"
          icon={<BellIcon className="size-5 shrink-0" />}
          onClick={() => {
            setSearchOpen(false)
            setNotifyOpen((open) => !open)
          }}
        />
        {notifyOpen ? (
          <div className="shell-side-pop" role="dialog" aria-label="通知">
            <p className="shell-chrome-pop-empty">暂无通知</p>
          </div>
        ) : null}
      </div>
      <SideAction
        title="设置"
        testId="chrome-settings"
        icon={<Cog6ToothIcon className="size-5 shrink-0" />}
        onClick={onSettings}
      />
    </div>
  )
}
