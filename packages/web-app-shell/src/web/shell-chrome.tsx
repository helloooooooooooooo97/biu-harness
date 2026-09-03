import { useCallback, useEffect, useState } from 'react'
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
import { chromeIcon } from './chrome-icon.ts'

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

export function ShellChromeBar({
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

  const openChat = () => {
    setChatOverlay(false)
    navigate(agentHref)
  }
  const openData = () => {
    navigate('/database')
  }

  return (
    <div className="shell-chrome-bar" data-testid="shell-chrome-bar">
      <div className="shell-chrome-bar-left">
        <button
          type="button"
          className={`shell-chrome-btn${activeId === 'agent' ? ' is-active' : ''}`}
          aria-pressed={activeId === 'agent'}
          data-testid="chrome-chat-panel"
          onClick={openChat}
        >
          <ChatBubbleLeftIcon {...chromeIcon} />
          聊天面板
        </button>
        <button
          type="button"
          className={`shell-chrome-btn${activeId === 'database' ? ' is-active' : ''}`}
          aria-pressed={activeId === 'database'}
          data-testid="chrome-data-panel"
          onClick={openData}
        >
          <CircleStackIcon {...chromeIcon} />
          数据面板
        </button>
      </div>
      <div className="shell-chrome-bar-right">
        <div className="shell-chrome-pop-wrap">
          <button
            type="button"
            className={`shell-chrome-btn icon-only${searchOpen ? ' is-active' : ''}`}
            title="搜索"
            aria-label="搜索"
            aria-expanded={searchOpen}
            data-testid="chrome-search"
            onClick={() => {
              setNotifyOpen(false)
              setSearchOpen((open) => !open)
            }}
          >
            <MagnifyingGlassIcon {...chromeIcon} />
          </button>
          {searchOpen ? (
            <div className="shell-chrome-pop" role="dialog" aria-label="搜索">
              <input
                className="shell-chrome-search-input"
                autoFocus
                placeholder="搜索…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <p className="shell-chrome-pop-empty">输入关键字以搜索会话与数据</p>
            </div>
          ) : null}
        </div>
        <div className="shell-chrome-pop-wrap">
          <button
            type="button"
            className={`shell-chrome-btn icon-only${notifyOpen ? ' is-active' : ''}`}
            title="通知"
            aria-label="通知"
            aria-expanded={notifyOpen}
            data-testid="chrome-notify"
            onClick={() => {
              setSearchOpen(false)
              setNotifyOpen((open) => !open)
            }}
          >
            <BellIcon {...chromeIcon} />
          </button>
          {notifyOpen ? (
            <div className="shell-chrome-pop" role="dialog" aria-label="通知">
              <p className="shell-chrome-pop-empty">暂无通知</p>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="shell-chrome-btn"
          title="设置"
          aria-label="设置"
          data-testid="chrome-settings"
          onClick={onSettings}
        >
          <Cog6ToothIcon {...chromeIcon} />
          设置
        </button>
      </div>
    </div>
  )
}
