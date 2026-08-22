import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { LuCheck, LuCoins, LuCopy, LuGitFork, LuHash, LuLayers, LuTimer, LuType, LuWrench } from 'react-icons/lu'
import type { SlotProps } from '../../registry/slots.ts'
import { bindSessionView, type SessionViewService } from '../../infrastructure/session-view.ts'
import {
  formatTrajectoryUsage,
  type ChatNode,
  type ChatStepStat,
  type TrajectoryUsage,
} from '../../infrastructure/session-project.ts'
import { SidebarMascot } from '../mascot/sidebar-mascot.tsx'
import { DEFAULT_SESSION_MASCOT, resolveSessionMascot } from '../mascot/session-mascot.ts'
import type { SessionMascotIdentity } from '../mascot/grok-bot-types.ts'
import { MarkdownBody } from './markdown.tsx'
import { ToolCard } from './tool-card.tsx'

const NEAR_BOTTOM_PX = 96
/** 提早预取更早消息，避免滑到顶才开始请求 */
const PREFETCH_OLDER_PX = 720
const ROW_GAP_PX = 16
const ESTIMATE_ROW_PX = 220
/** 超过该条数才上虚表；过低阈值会抖，过高则短会话也会一次挂满 Markdown */
const VIRTUALIZE_AFTER = 4
/** overscan 过大时可视区外仍挂大量 Markdown DOM，拖死主线程 */
const OVERSCAN = 3
/** 滚动停下多久后，给尚未 hydrate 的行补上完整渲染 */
const SCROLL_IDLE_MS = 140
/** 停下后每帧最多新 hydrate 几行，避免一次补齐打爆主线程 */
const HYDRATE_PER_IDLE = 1

function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null
  while (node) {
    const { overflowY } = getComputedStyle(node)
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') return node
    node = node.parentElement
  }
  return null
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${Math.max(0, Math.round(ms))}ms`
  if (ms < 60_000) {
    const sec = ms / 1000
    return `${sec < 10 ? sec.toFixed(1) : Math.round(sec)}s`
  }
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.round((ms % 60_000) / 1000)
  return `${minutes}m ${seconds}s`
}

function formatTok(n: number) {
  return n.toLocaleString('en-US')
}

function stepLabel(step: number) {
  // event.step 从 0 起；展示用 Step 1 / Step 2
  return `Step ${step + 1}`
}

function MetaItem({
  icon,
  value,
  title,
}: {
  icon: ReactNode
  value: ReactNode
  title: string
}) {
  return (
    <span className="chat-reply-meta-item" title={title}>
      <span className="chat-reply-meta-icon" aria-hidden>
        {icon}
      </span>
      <span className="chat-reply-meta-value">{value}</span>
    </span>
  )
}

function StepBar({ stat }: { stat: ChatStepStat }) {
  const usage: TrajectoryUsage = {
    inputTokens: stat.inputTokens,
    outputTokens: stat.outputTokens,
    totalTokens: stat.inputTokens + stat.outputTokens,
    ...(stat.cacheReadTokens ? { cacheReadTokens: stat.cacheReadTokens } : {}),
  }
  return (
    <div className="chat-step-bar" role="group" aria-label={stepLabel(stat.step)}>
      <div className="chat-reply-meta">
        <MetaItem icon={<LuLayers className="size-3" />} value={stat.step + 1} title={stepLabel(stat.step)} />
        <MetaItem
          icon={<LuCoins className="size-3" />}
          value={<UsageInline usage={usage} />}
          title="本步 Token 用量"
        />
        <MetaItem icon={<LuWrench className="size-3" />} value={stat.toolCount} title={`本步 ${stat.toolCount} 个工具`} />
        <MetaItem
          icon={<LuType className="size-3" />}
          value={formatTok(stat.messageChars)}
          title={`本步 Message ${formatTok(stat.messageChars)} 字`}
        />
      </div>
    </div>
  )
}

function ReplyParts({
  node,
  onInspect,
}: {
  node: Extract<ChatNode, { kind: 'reply' }>
  onInspect: (callId: string) => void
}) {
  const stepMap = new Map((node.steps ?? []).map((item) => [item.step, item]))
  const elements: ReactNode[] = []
  let lastStep: number | undefined

  for (const part of node.parts) {
    const step = part.step
    if (step != null && step !== lastStep) {
      const stat = stepMap.get(step) ?? {
        step,
        inputTokens: 0,
        outputTokens: 0,
        toolCount: 0,
        messageChars: 0,
      }
      elements.push(<StepBar key={`step-${step}`} stat={stat} />)
      lastStep = step
    }

    if (part.kind === 'assistant') {
      const partStreaming = Boolean(part.streaming)
      elements.push(
        <div key={part.id} className="chat-assistant-body">
          {part.text ? (
            <MarkdownBody text={part.text} streaming={partStreaming} />
          ) : partStreaming ? (
            '…'
          ) : null}
          {partStreaming ? (
            <span className="ml-1 inline-block animate-pulse text-[var(--dsw-label-3)]">▍</span>
          ) : null}
        </div>,
      )
    } else {
      elements.push(<ToolCard key={part.id} node={part} onInspect={onInspect} />)
    }
  }

  return <>{elements}</>
}

function cacheHitPct(usage: TrajectoryUsage): number | null {
  if (!usage.inputTokens || !usage.cacheReadTokens) return null
  return Math.min(100, Math.round((usage.cacheReadTokens / usage.inputTokens) * 100))
}

function UsageInline({ usage }: { usage: TrajectoryUsage }) {
  const pct = cacheHitPct(usage)
  const inStyle: CSSProperties | undefined =
    pct != null
      ? {
          backgroundImage: `linear-gradient(90deg, rgba(34, 140, 90, 0.28) 0%, rgba(34, 140, 90, 0.28) ${pct}%, rgba(15, 17, 21, 0.06) ${pct}%, rgba(15, 17, 21, 0.06) 100%)`,
        }
      : undefined
  return (
    <span className="traj-usage" title={formatTrajectoryUsage(usage)}>
      <span
        className={`traj-usage-in-wrap${pct != null ? ' has-cache' : ''}`}
        style={inStyle}
        title={
          pct != null
            ? `input ${formatTok(usage.inputTokens)} · cache hit ${pct}% (${formatTok(usage.cacheReadTokens!)})`
            : `input ${formatTok(usage.inputTokens)}`
        }
      >
        <span className="traj-usage-in">{formatTok(usage.inputTokens)}</span>
        {pct != null ? <span className="traj-usage-cache-pct">{pct}%</span> : null}
      </span>
      <span className="traj-usage-arrow" aria-hidden>
        →
      </span>
      <span className="traj-usage-out" title="output tokens">
        {formatTok(usage.outputTokens)}
      </span>
    </span>
  )
}

function RowLoading({ kind }: { kind: ChatNode['kind'] }) {
  const label =
    kind === 'user' ? '消息加载中' : kind === 'reply' ? '回复加载中' : kind === 'turn' ? '状态加载中' : '加载中'
  return (
    <div className="chat-row-loading" aria-busy="true" aria-label={label}>
      <span className="chat-row-loading-dot" />
      <span className="chat-row-loading-dot" />
      <span className="chat-row-loading-dot" />
    </div>
  )
}

function ReplyActions({
  text,
  onFork,
}: {
  text: string
  onFork: () => void | Promise<void>
}) {
  const [copied, setCopied] = useState(false)
  const [forkBusy, setForkBusy] = useState(false)

  async function copy() {
    if (!text.trim()) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      /* clipboard may be denied */
    }
  }

  async function fork() {
    if (forkBusy) return
    setForkBusy(true)
    try {
      await onFork()
    } finally {
      setForkBusy(false)
    }
  }

  return (
    <div className="chat-reply-actions" role="group" aria-label="回合操作">
      <button
        type="button"
        className={`chat-assistant-action${copied ? ' is-done' : ''}`}
        title={copied ? '已复制' : '复制'}
        aria-label={copied ? '已复制' : '复制本回合回复'}
        onClick={() => void copy()}
      >
        {copied ? <LuCheck className="size-3.5" /> : <LuCopy className="size-3.5" />}
      </button>
      <button
        type="button"
        className="chat-assistant-action"
        title="Fork 会话"
        aria-label="Fork 会话"
        disabled={forkBusy}
        onClick={() => void fork()}
      >
        <LuGitFork className="size-3.5" />
      </button>
    </div>
  )
}

function NodeView({
  node,
  onInspect,
  onFork,
  hydrated,
}: {
  node: ChatNode
  onInspect: (callId: string) => void
  onFork: () => void | Promise<void>
  /** false = 滚动中新进视口，只显示 loading，不动已 hydrate 的 Markdown */
  hydrated: boolean
}) {
  if (!hydrated) {
    return <RowLoading kind={node.kind} />
  }

  if (node.kind === 'user') {
    return (
      <div className="chat-user-row">
        <div className="chat-user-bubble">
          {node.kindTag === 'inject' ? <div className="chat-user-tag">inject</div> : null}
          <MarkdownBody text={node.text} />
        </div>
      </div>
    )
  }

  if (node.kind === 'reply') {
    const streaming = Boolean(node.streaming)
    const showFooter = !streaming
    return (
      <div className="chat-reply-block">
        <div className={`chat-reply-card${streaming ? ' is-streaming' : ''}`}>
          <div className="chat-reply-body">
            <ReplyParts node={node} onInspect={onInspect} />
          </div>
        </div>
        {showFooter ? (
          <div className="chat-reply-bar" aria-label="回合摘要">
            <div className="chat-reply-meta">
              {node.turn != null ? (
                <MetaItem icon={<LuHash className="size-3" />} value={node.turn} title={`第 ${node.turn} 轮`} />
              ) : null}
              {node.stepCount != null ? (
                <MetaItem
                  icon={<LuLayers className="size-3" />}
                  value={node.stepCount}
                  title={`本回合 ${node.stepCount} 个 step`}
                />
              ) : null}
              {node.durationMs != null ? (
                <MetaItem
                  icon={<LuTimer className="size-3" />}
                  value={formatDuration(node.durationMs)}
                  title="本回合耗时"
                />
              ) : null}
              {node.usage ? (
                <MetaItem icon={<LuCoins className="size-3" />} value={<UsageInline usage={node.usage} />} title="Token 用量" />
              ) : null}
              {node.turn == null && node.stepCount == null && node.durationMs == null && !node.usage ? (
                <span className="chat-reply-meta-empty">—</span>
              ) : null}
            </div>
            {node.copyText.trim() ? <ReplyActions text={node.copyText} onFork={onFork} /> : null}
          </div>
        ) : null}
      </div>
    )
  }

  return <div className="self-center text-xs text-[var(--dsw-label-3)]">{node.text}</div>
}

const NodeViewMemo = memo(NodeView)

function EmptyHero({
  identity,
  busy,
  sessionId,
}: {
  identity: SessionMascotIdentity
  busy: boolean
  sessionId?: string
}) {
  return (
    <div className="chat-empty-hero">
      <div className="chat-empty-hero-glow" aria-hidden />
      <div className="chat-empty-hero-inner">
        <div className="chat-empty-hero-mascot">
          <SidebarMascot
            size={112}
            sessionId={sessionId}
            identity={identity}
            busy={busy}
            title={`${identity.shape} · ${identity.color}`}
          />
        </div>
        <h2 className="chat-empty-hero-title">Need a hand?</h2>
      </div>
    </div>
  )
}

function StatusRow({
  agentStatus,
  agentStep,
}: {
  agentStatus: 'idle' | 'running'
  agentStep?: number
}) {
  return (
    <div className="mb-4 flex items-center gap-2 text-xs text-[var(--dsw-label-3)]">
      <span
        className={`size-2 rounded-full ${agentStatus === 'running' ? 'bg-[var(--dsw-ok)]' : 'bg-[var(--dsw-hover-strong)]'}`}
        aria-hidden
      />
      <span>{agentStatus === 'running' ? `Running${agentStep != null ? ` · step ${agentStep}` : ''}` : 'Idle'}</span>
    </div>
  )
}

export const ChatThread = memo(function ChatThread(props: SlotProps) {
  const useSessionView = props.useSessionView as ReturnType<typeof bindSessionView>
  const sessionView = props.sessionView as SessionViewService
  const navigate = useNavigate()
  const nodes = useSessionView((state) => state.nodes)
  const pending = useSessionView((state) => state.pending)
  const agentStatus = useSessionView((state) => state.agentStatus)
  const agentStep = useSessionView((state) => state.agentStep)
  const sessionId = useSessionView((state) => state.sessionId)
  const sessions = useSessionView((state) => state.sessions)
  const error = useSessionView((state) => state.error)
  const switchingSession = useSessionView((state) => state.switchingSession)
  const hasMoreOlder = useSessionView((state) => state.hasMoreOlder)
  const loadingOlder = useSessionView((state) => state.loadingOlder)
  const rootRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLElement | null>(null)
  const stickToBottomRef = useRef(true)
  const scrollIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prefetchingRef = useRef(false)
  /** 已完整渲染过的行：滚动中也不降级成原文 / stub */
  const hydratedRef = useRef(new Set<string>())
  const [scrollEpoch, setScrollEpoch] = useState(0)
  const [isScrolling, setIsScrolling] = useState(false)
  /** 允许从列表末尾往前 hydrate 的条数；idle 时递增，避免一次挂满 Markdown */
  const [hydrateQuota, setHydrateQuota] = useState(4)

  const virtualize = nodes.length >= VIRTUALIZE_AFTER

  const onInspect = useCallback(
    (callId: string) => {
      sessionView.inspectCall(callId)
      if (sessionId) navigate(`/s/${sessionId}/debug`)
    },
    [sessionView, sessionId, navigate],
  )

  const onFork = useCallback(() => {
    return sessionView.forkCurrent().then((id) => {
      navigate(`/s/${id}`)
    })
  }, [sessionView, navigate])

  useEffect(() => {
    hydratedRef.current = new Set()
    setIsScrolling(false)
    setHydrateQuota(4)
  }, [sessionId])

  useEffect(() => {
    if (isScrolling) return
    if (hydrateQuota >= nodes.length) return
    let cancelled = false
    let handle = 0
    const bump = () => {
      if (cancelled) return
      setHydrateQuota((value) => Math.min(nodes.length, value + HYDRATE_PER_IDLE))
    }
    handle =
      typeof requestIdleCallback === 'function'
        ? requestIdleCallback(bump, { timeout: 200 })
        : window.setTimeout(bump, 32)
    return () => {
      cancelled = true
      if (typeof cancelIdleCallback === 'function') cancelIdleCallback(handle)
      else window.clearTimeout(handle)
    }
  }, [isScrolling, hydrateQuota, nodes.length, sessionId])

  useLayoutEffect(() => {
    const parent = findScrollParent(rootRef.current)
    if (parent && parent !== scrollRef.current) {
      scrollRef.current = parent
      setScrollEpoch((value) => value + 1)
    }
  }, [sessionId])

  const virtualizer = useVirtualizer({
    count: virtualize ? nodes.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATE_ROW_PX,
    overscan: OVERSCAN,
    gap: ROW_GAP_PX,
    getItemKey: (index) => nodes[index]?.id ?? index,
  })

  useEffect(() => {
    stickToBottomRef.current = true
  }, [sessionId])

  useEffect(() => {
    if (pending) stickToBottomRef.current = true
  }, [pending])

  useEffect(() => {
    const parent = scrollRef.current
    if (!parent) return

    const markScrolling = () => {
      setIsScrolling(true)
      if (scrollIdleTimer.current != null) clearTimeout(scrollIdleTimer.current)
      scrollIdleTimer.current = setTimeout(() => {
        scrollIdleTimer.current = null
        setIsScrolling(false)
      }, SCROLL_IDLE_MS)
    }

    const maybePrefetchOlder = () => {
      if (!hasMoreOlder || loadingOlder || prefetchingRef.current) return
      if (parent.scrollTop > PREFETCH_OLDER_PX) return
      const beforeHeight = parent.scrollHeight
      const beforeTop = parent.scrollTop
      prefetchingRef.current = true
      void sessionView
        .loadOlder()
        .then((loaded) => {
          if (!loaded) return
          requestAnimationFrame(() => {
            parent.scrollTop = beforeTop + (parent.scrollHeight - beforeHeight)
          })
        })
        .finally(() => {
          prefetchingRef.current = false
        })
    }

    const onScroll = () => {
      markScrolling()
      const distance = parent.scrollHeight - parent.scrollTop - parent.clientHeight
      stickToBottomRef.current = distance <= NEAR_BOTTOM_PX
      maybePrefetchOlder()
    }
    onScroll()
    parent.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      parent.removeEventListener('scroll', onScroll)
      if (scrollIdleTimer.current != null) clearTimeout(scrollIdleTimer.current)
    }
  }, [sessionId, scrollEpoch, virtualize, hasMoreOlder, loadingOlder, sessionView])

  const lastNode = nodes.at(-1)
  // 流式时按 ~96 字符步进 stickKey，避免每个 delta 都触发布局滚动
  const stickKey =
    lastNode?.kind === 'reply' && lastNode.streaming
      ? `${lastNode.id}:${Math.floor(lastNode.copyText.length / 96)}:1`
      : `${nodes.length}:${pending ? 1 : 0}:${error ?? ''}`

  useLayoutEffect(() => {
    if (!stickToBottomRef.current || nodes.length === 0) return
    const parent = scrollRef.current
    // 流式时直接改 scrollTop，避免 virtualizer.scrollToIndex 每帧重测布局
    if (parent) parent.scrollTop = parent.scrollHeight
  }, [stickKey, nodes.length])

  if (nodes.length === 0 && !pending && !error && !switchingSession) {
    const session = sessions.find((item) => item.id === sessionId)
    const identity = sessionId
      ? resolveSessionMascot(sessionId, session?.mascot)
      : DEFAULT_SESSION_MASCOT
    return (
      <EmptyHero
        identity={identity}
        busy={agentStatus === 'running'}
        sessionId={sessionId ?? undefined}
      />
    )
  }

  const rowHydrated = (node: ChatNode, index: number) => {
    if (hydratedRef.current.has(node.id)) return true
    // 流式回复：直接展示，不走 loading
    if (node.kind === 'reply' && node.streaming) {
      hydratedRef.current.add(node.id)
      return true
    }
    // 滚动中：新进视口的行先 stub，避免一边滑一边 remark
    if (virtualize && isScrolling) return false
    // 从底部往上按配额 hydrate（用户通常看最新）
    const fromEnd = nodes.length - 1 - index
    if (fromEnd < hydrateQuota) {
      hydratedRef.current.add(node.id)
      return true
    }
    return false
  }

  return (
    <div
      ref={rootRef}
      className="w-full"
      data-chat-virtual={virtualize ? '1' : '0'}
      data-switching={switchingSession ? '1' : undefined}
      style={switchingSession ? { opacity: 0.72, transition: 'opacity 120ms ease' } : undefined}
    >
      <StatusRow agentStatus={agentStatus} agentStep={agentStep} />
      {loadingOlder ? (
        <div className="mb-3 text-center text-[11px] text-[var(--dsw-label-3)]">加载更早消息…</div>
      ) : null}
      {virtualize ? (
        <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((item) => {
            const node = nodes[item.index]
            if (!node) return null
            const hydrated = rowHydrated(node, item.index)
            return (
              <div
                key={item.key}
                data-index={item.index}
                ref={isScrolling && !hydrated ? undefined : virtualizer.measureElement}
                className="chat-virt-row absolute top-0 left-0 w-full"
                style={{ transform: `translateY(${item.start}px)` }}
              >
                <NodeViewMemo
                  node={node}
                  onInspect={onInspect}
                  onFork={onFork}
                  hydrated={hydrated}
                />
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {nodes.map((node, index) => (
            <NodeViewMemo
              key={node.id}
              node={node}
              onInspect={onInspect}
              onFork={onFork}
              hydrated={rowHydrated(node, index)}
            />
          ))}
        </div>
      )}
      {error ? (
        <div className="mt-4 rounded-[12px] bg-[var(--dsw-danger-soft)] px-3 py-2 text-sm text-[var(--dsw-danger)]">{error}</div>
      ) : null}
    </div>
  )
})

export function chatThreadProps(view: SessionViewService) {
  return { useSessionView: bindSessionView(view) }
}
