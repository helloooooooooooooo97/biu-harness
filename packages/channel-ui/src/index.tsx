import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import type { Context } from 'cordis'
import { LuHash, LuPlus, LuSend, LuUsers, LuLink, LuMessageSquare, LuServer } from 'react-icons/lu'

export type SlotProps = Record<string, unknown> & {
  renderSlot?: (name: string) => unknown
}

type SlotsService = {
  place: (
    slot: string,
    view: unknown,
    opts: { key: string; order: number; props?: () => Record<string, unknown> },
  ) => unknown
}

type Channel = { id: string; name: string; owner: string; createdAt: number }
type ChannelMember = {
  channelId: string
  memberId: string
  name: string
  role: string
  cursorSeq: number
  joinedAt: number
}
type ChannelMessage = { seq: number; channelId: string; sender: string; kind: string; payload: unknown; ts: number }
type ChannelInvite = { id: string; channelId: string; role: string; expiresAt: number | null; maxUses: number | null; used: number }

/** 本机成员身份：默认存 localStorage，每台内网主机可用自己的标识 */
function getSelfId(): string {
  try {
    let id = localStorage.getItem('cordis.channel.self')
    if (!id) {
      id = `host_${Math.random().toString(36).slice(2, 8)}`
      localStorage.setItem('cordis.channel.self', id)
    }
    return id
  } catch {
    return `host_${Math.random().toString(36).slice(2, 8)}`
  }
}
function getSelfName(): string {
  try {
    return localStorage.getItem('cordis.channel.selfName') ?? getSelfId()
  } catch {
    return getSelfId()
  }
}

/** 追加到频道内多机共享的最新 seq：本机简单的本地追踪（真正收敛靠后端单一事实来源 + 游标） */
function loadCursor(channelId: string): number {
  try {
    const n = Number(localStorage.getItem(`cordis.channel.cursor.${channelId}`) ?? 0)
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}
function saveCursor(channelId: string, seq: number) {
  try {
    localStorage.setItem(`cordis.channel.cursor.${channelId}`, String(seq))
  } catch {
    /* ignore */
  }
}

// ==================== 数据层 ====================

/** 中转 broker 地址：默认空 = 本机（自己就是 broker）。其他内网机器填 broker 的 http://ip:port */
function getBroker(): string {
  try {
    return (localStorage.getItem('cordis.channel.broker') ?? '').trim()
  } catch {
    return ''
  }
}
function setBroker(url: string) {
  try {
    localStorage.setItem('cordis.channel.broker', url.trim())
  } catch {
    /* ignore */
  }
}

/** 拆掉 broker 前缀尾斜杠，拼成完整 URL */
function resolveUrl(path: string): string {
  const broker = getBroker()
  if (!broker) return path // 本机就是 broker，走相对路径
  return `${broker.replace(/\/+$/, '')}${path}`
}

async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(resolveUrl(path), init)
  const body = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`)
  return body
}

type ChannelModulePageProps = SlotProps & { renderSlot: (name: string, opts?: { kind?: string }) => unknown }

function ChannelModulePage(_props: ChannelModulePageProps) {
  const [channels, setChannels] = useState<Channel[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [members, setMembers] = useState<ChannelMember[]>([])
  const [messages, setMessages] = useState<ChannelMessage[]>([])
  const [invite, setInvite] = useState<ChannelInvite | null>(null)
  const [input, setInput] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [showJoin, setShowJoin] = useState(false)
  const [selfId] = useState(getSelfId)
  const [selfName, setSelfName] = useState(getSelfName)
  const [broker, setBrokerState] = useState(getBroker)
  const [showBroker, setShowBroker] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const active = channels.find((c) => c.id === activeId) ?? null

  const refreshChannels = useCallback(async () => {
    try {
      const data = await api<{ channels: Channel[] }>('/api/channels')
      setChannels(data.channels)
      setActiveId((cur) => (data.channels.some((c) => c.id === cur) ? cur : data.channels[0]?.id ?? null))
    } catch {
      /* ignore */
    }
  }, [])

  // 拉频道列表
  useEffect(() => {
    void refreshChannels()
  }, [refreshChannels])

  // 拉消息（游标增量）——当前频道循环轮询，实现多机同步的收敛
  useEffect(() => {
    if (!activeId) return
    let alive = true
    const pull = async () => {
      try {
        const after = loadCursor(activeId)
        const data = await api<{ messages: ChannelMessage[]; latestSeq: number }>(
          `/api/channels/${activeId}/messages?after=${after}`,
        )
        if (!alive) return
        if (data.messages.length) {
          setMessages((prev) => {
            const have = new Set(prev.map((m) => m.seq))
            const fresh = data.messages.filter((m) => !have.has(m.seq))
            return [...prev, ...fresh]
          })
          saveCursor(activeId, data.latestSeq)
        }
      } catch {
        /* ignore */
      }
    }
    void pull()
    const timer = setInterval(pull, 2500)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [activeId])

  // 拉成员
  useEffect(() => {
    if (!activeId) return
    void api<{ members: ChannelMember[] }>(`/api/channels/${activeId}/members`)
      .then((d) => setMembers(d.members))
      .catch(() => setMembers([]))
  }, [activeId])

  // 到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, activeId])

  const onCreateChannel = async (e: FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      const d = await api<{ channel: Channel }>('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), owner: selfName }),
      })
      setActiveId(d.channel.id)
      setNewName('')
      setShowNew(false)
      await refreshChannels()
    } catch {
      /* ignore */
    }
  }

  const onSend = async (e: FormEvent) => {
    e.preventDefault()
    if (!activeId || !input.trim()) return
    try {
      await api(`/api/channels/${activeId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: selfName, kind: 'text', payload: input.trim() }),
      })
      setInput('')
      loadCursor(activeId)
    } catch {
      /* ignore */
    }
  }

  const onCreateInvite = async () => {
    if (!activeId) return
    try {
      const d = await api<{ invite: ChannelInvite }>(`/api/channels/${activeId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      setInvite(d.invite)
      setShowInvite(true)
    } catch {
      /* ignore */
    }
  }

  const onJoin = async (e: FormEvent) => {
    e.preventDefault()
    if (!inviteCode.trim()) return
    try {
      await api<{ channel: Channel }>(`/api/invites/${inviteCode.trim()}/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: selfId, name: selfName }),
      })
      setInviteCode('')
      setShowJoin(false)
      await refreshChannels()
    } catch {
      /* ignore */
    }
  }

  const onSaveBroker = async (e: FormEvent) => {
    e.preventDefault()
    setBroker(broker)
    setShowBroker(false)
    await refreshChannels()
  }

  return (
    <div className="channels-module-page">
      <div className="channels-root">
        {/* 频道列表 */}
        <aside className="channels-list">
          <div className="channels-list-head">
            <span className="channels-list-title">频道</span>
            <button
              className="channels-icon-btn"
              title="新建频道"
              aria-label="新建频道"
              onClick={() => setShowNew((v) => !v)}
            >
              <LuPlus className="size-4" />
            </button>
          </div>
          {showNew ? (
            <form className="channels-new" onSubmit={onCreateChannel}>
              <input
                className="channels-input"
                placeholder="频道名"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
              <button className="channels-primary" type="submit">
                创建
              </button>
            </form>
          ) : null}
          <ul className="channels-list-items">
            {channels.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={`channels-list-item${c.id === activeId ? ' is-active' : ''}`}
                  onClick={() => setActiveId(c.id)}
                >
                  <LuHash className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                </button>
              </li>
            ))}
            {!channels.length ? <li className="channels-empty">暂无频道</li> : null}
          </ul>
          <div className="channels-list-foot">
            <button className="channels-foot-btn" type="button" onClick={() => setShowJoin((v) => !v)}>
              <LuLink className="size-4" /> 加入频道
            </button>
            {showJoin ? (
              <form className="channels-new" onSubmit={onJoin}>
                <input
                  className="channels-input"
                  placeholder="邀请码"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                />
                <button className="channels-primary" type="submit">
                  加入
                </button>
              </form>
            ) : null}
            <button className="channels-foot-btn" type="button" onClick={() => setShowBroker((v) => !v)}>
              <LuServer className="size-4" />
              {broker ? <span className="truncate">{broker}</span> : '状态：本机（broker）'}
            </button>
            {showBroker ? (
              <form className="channels-new" onSubmit={onSaveBroker}>
                <input
                  className="channels-input"
                  placeholder="broker http://192.168.x.x:5141（留空=本机）"
                  value={broker}
                  onChange={(e) => setBrokerState(e.target.value)}
                />
                <button className="channels-primary" type="submit">
                  保存
                </button>
              </form>
            ) : null}
          </div>
        </aside>

        {/* 消息主区 */}
        <section className="channels-main">
          {!active ? (
            <div className="channels-placeholder">选择或创建一个频道</div>
          ) : (
            <>
              <header className="channels-head">
                <div className="channels-head-left">
                  <LuHash className="size-4" />
                  <span className="channels-title">{active.name}</span>
                </div>
                <div className="channels-head-right">
                  <span className="channels-members-count">
                    <LuUsers className="size-3.5" /> {members.length}
                  </span>
                  <button className="channels-icon-btn" title="邀请" aria-label="邀请" onClick={onCreateInvite}>
                    <LuLink className="size-4" />
                  </button>
                </div>
              </header>
              <div className="channels-thread">
                {messages.map((m) => (
                  <div className="channels-msg" key={m.seq}>
                    <span className="channels-msg-sender">{m.sender}</span>
                    <span className="channels-msg-time">{new Date(m.ts).toLocaleTimeString()}</span>
                    <p className="channels-msg-body">{String((m.payload as { text?: string })?.text ?? m.payload ?? '')}</p>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <form className="channels-composer" onSubmit={onSend}>
                <LuMessageSquare className="size-4 shrink-0 text-[var(--dsw-label-3)]" />
                <input
                  className="channels-input"
                  placeholder="发消息到频道…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
                <button className="channels-primary" type="submit">
                  <LuSend className="size-4" />
                </button>
              </form>
            </>
          )}
        </section>
      </div>

      {/* 邀请弹层 */}
      {showInvite ? (
        <div className="channels-overlay" role="dialog" aria-modal="true" onClick={() => setShowInvite(false)}>
          <div className="channels-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="channels-modal-title">频道邀请</h3>
            <p className="channels-modal-desc">把下面邀请码发给要加入的内网主机，对方在「加入频道」里兑换。</p>
            {invite ? (
              <pre className="channels-invite-code">{invite.id}</pre>
            ) : null}
            <button className="channels-primary" type="button" onClick={() => setShowInvite(false)}>
              完成
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export const inject = ['slots', 'appModules']

const channelsModuleProps = { moduleId: 'channels' }

function ChannelsRailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? 'size-5'} fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h10M7 3v4M11 3v4M15 3v4M19 3v4" />
      <circle cx="19" cy="18" r="2.4" />
    </svg>
  )
}

type AppModulesService = {
  register: (mod: {
    id: string
    label: string
    path: string
    description?: string
    order?: number
    Icon?: (props: { className?: string }) => unknown
  }) => unknown
}

export function apply(ctx: Context) {
  const slots = ctx.get('slots') as SlotsService | undefined
  const appModules = ctx.get('appModules') as AppModulesService | undefined
  if (!slots) throw new Error('slots service required')
  if (!appModules) throw new Error('appModules service required')
  appModules.register({
    id: 'channels',
    label: '频道',
    path: '/channels',
    description: '内网分布式群聊',
    order: 30,
    Icon: ChannelsRailIcon,
  })
  slots.place('app-modules', ChannelModulePage, {
    key: 'channels-module',
    order: 30,
    props: () => channelsModuleProps,
  })
}

if (typeof document !== 'undefined') {
  const id = 'hmr-channels-ui-style'
  const style = document.getElementById(id) ?? document.createElement('style')
  style.id = id
  style.textContent = `
.channels-module-page { display:flex; flex:1; min-height:0; flex-direction:column; overflow:hidden;
  background: radial-gradient(900px 360px at 10% -12%, color-mix(in srgb, var(--dsw-business) 8%, transparent), transparent 58%),
  linear-gradient(180deg, color-mix(in srgb, var(--dsw-surface) 55%, var(--dsw-bg)), var(--dsw-bg));
  color:var(--dsw-label); }
.channels-root { display:flex; min-height:0; flex:1; overflow:hidden; }
.channels-list { display:flex; width:220px; min-height:0; flex-direction:column; border-right:1px solid var(--dsw-border); background:color-mix(in srgb, var(--dsw-surface) 70%, transparent); }
.channels-list-head { display:flex; align-items:center; justify-content:space-between; padding:12px 12px 8px; }
.channels-list-title { font-size:13px; font-weight:600; }
.channels-icon-btn { display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; border:1px solid var(--dsw-border); border-radius:8px; background:transparent; color:var(--dsw-label-2); cursor:pointer; }
.channels-icon-btn:hover { color:var(--dsw-business); border-color:var(--dsw-business); }
.channels-new { display:flex; gap:6px; padding:4px 12px 8px; }
.channels-input { min-width:0; flex:1; border:1px solid var(--dsw-border); border-radius:10px; background:var(--dsw-surface); padding:7px 10px; font-size:13px; color:var(--dsw-label); outline:none; }
.channels-input:focus { border-color:var(--dsw-business); }
.channels-primary { display:inline-flex; align-items:center; gap:4px; border:none; border-radius:10px; padding:7px 12px; font-size:13px; background:var(--dsw-business); color:var(--dsw-bg); cursor:pointer; white-space:nowrap; }
.channels-list-items { flex:1; min-height:0; overflow-y:auto; display:flex; flex-direction:column; gap:2px; padding:0 8px; list-style:none; margin:0; }
.channels-list-item { display:flex; align-items:center; gap:8px; width:100%; border:none; background:transparent; color:var(--dsw-label-2); padding:8px 10px; border-radius:10px; cursor:pointer; text-align:left; font-size:13px; }
.channels-list-item:hover { background:color-mix(in srgb, var(--dsw-sidebar) 60%, transparent); }
.channels-list-item.is-active { background:var(--dsw-business-soft); color:var(--dsw-business); font-weight:600; }
.channels-empty { padding:12px; color:var(--dsw-label-3); font-size:12px; }
.channels-list-foot { display:flex; flex-direction:column; gap:6px; padding:10px 12px; border-top:1px solid var(--dsw-border); }
.channels-foot-btn { display:inline-flex; align-items:center; gap:6px; border:none; background:transparent; color:var(--dsw-label-2); font-size:12px; cursor:pointer; padding:4px 0; }
.channels-foot-btn:hover { color:var(--dsw-business); }
.channels-main { display:flex; min-width:0; min-height:0; flex:1; flex-direction:column; overflow:hidden; }
.channels-placeholder { display:flex; flex:1; align-items:center; justify-content:center; color:var(--dsw-label-3); font-size:14px; }
.channels-head { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px 16px; border-bottom:1px solid var(--dsw-border); }
.channels-head-left { display:flex; align-items:center; gap:8px; }
.channels-title { font-size:15px; font-weight:700; }
.channels-head-right { display:flex; align-items:center; gap:8px; }
.channels-members-count { display:inline-flex; align-items:center; gap:4px; color:var(--dsw-label-3); font-size:12px; }
.channels-thread { flex:1; min-height:0; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:10px; }
.channels-msg { display:flex; flex-direction:column; gap:2px; }
.channels-msg-sender { font-size:12px; font-weight:600; color:var(--dsw-business); }
.channels-msg-time { font-size:11px; color:var(--dsw-label-3); }
.channels-msg-body { margin:0; font-size:14px; line-height:1.5; color:var(--dsw-label); }
.channels-composer { display:flex; align-items:center; gap:8px; padding:12px 16px; border-top:1px solid var(--dsw-border); }
.channels-overlay { position:fixed; inset:0; z-index:40; display:flex; align-items:center; justify-content:center; background:var(--dsw-overlay); }
.channels-modal { width:360px; max-width:calc(100vw - 40px); display:flex; flex-direction:column; gap:10px; border:1px solid var(--dsw-border); border-radius:16px; background:var(--dsw-surface); padding:20px; }
.channels-modal-title { margin:0; font-size:16px; font-weight:700; }
.channels-modal-desc { margin:0; font-size:12px; color:var(--dsw-label-3); }
.channels-invite-code { margin:0; padding:12px; border:1px dashed var(--dsw-border); border-radius:10px; background:var(--dsw-sidebar); font-family:monospace; font-size:14px; user-select:all; }
`
  if (!document.getElementById(id)) document.head.appendChild(style)
}
