import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { defaultRangeExtractor, useVirtualizer, type Range } from '@tanstack/react-virtual'
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
/** 超过该条数才上虚表；短会话直接全量挂载，避免来回滚卸 DOM */
const VIRTUALIZE_AFTER = 12
/** overscan：来回小幅滚动时尽量别卸刚看过的行 */
const OVERSCAN = 12
/** 看过的行继续挂在树上（LRU），滚回去不再重建 Markdown DOM */
const KEEP_MOUNTED_MAX = 80

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
}: {
  node: ChatNode
  onInspect: (callId: string) => void
  onFork: () => void | Promise<void>
}) {
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
  const prefetchingRef = useRef(false)
  /** 看过的消息按 id 保活（不能按 index：loadOlder 前置后下标会漂） */
  const keptIdOrderRef = useRef<string[]>([])
  const keptIdSetRef = useRef(new Set<string>())
  const [scrollEpoch, setScrollEpoch] = useState(0)
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes

  const virtualize = nodes.length >= VIRTUALIZE_AFTER

  const clearKept = useCallback(() => {
    keptIdOrderRef.current = []
    keptIdSetRef.current = new Set()
  }, [])

  const touchKeptId = useCallback((id: string) => {
    const set = keptIdSetRef.current
    let order = keptIdOrderRef.current
    if (set.has(id)) {
      order = order.filter((item) => item !== id)
      order.push(id)
      keptIdOrderRef.current = order
      return
    }
    while (order.length >= KEEP_MOUNTED_MAX) {
      const drop = order.shift()
      if (drop != null) set.delete(drop)
    }
    order.push(id)
    set.add(id)
    keptIdOrderRef.current = order
  }, [])

  const rangeExtractor = useCallback((range: Range) => {
    const defaults = defaultRangeExtractor(range)
    const merged = new Set(defaults)
    const list = nodesRef.current
    const idToIndex = new Map<string, number>()
    for (let index = 0; index < list.length; index += 1) {
      idToIndex.set(list[index]!.id, index)
    }
    for (const id of keptIdSetRef.current) {
      const index = idToIndex.get(id)
      if (index != null) merged.add(index)
    }
    const last = list.length - 1
    const lastNode = last >= 0 ? list[last] : null
    if (lastNode?.kind === 'reply' && lastNode.streaming) merged.add(last)
    return [...merged].sort((a, b) => a - b)
  }, [])

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
    clearKept()
  }, [sessionId, clearKept])

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
    rangeExtractor,
  })

  const rangeStart = virtualizer.range?.startIndex
  const rangeEnd = virtualizer.range?.endIndex
  useLayoutEffect(() => {
    if (!virtualize) return
    if (rangeStart == null || rangeEnd == null) return
    const list = nodesRef.current
    for (let index = rangeStart; index <= rangeEnd; index += 1) {
      const id = list[index]?.id
      if (id) touchKeptId(id)
    }
  }, [virtualize, rangeStart, rangeEnd, touchKeptId, sessionId, nodes.length])

  useEffect(() => {
    stickToBottomRef.current = true
  }, [sessionId])

  useEffect(() => {
    if (pending) stickToBottomRef.current = true
  }, [pending])

  useEffect(() => {
    const parent = scrollRef.current
    if (!parent) return

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
      const distance = parent.scrollHeight - parent.scrollTop - parent.clientHeight
      stickToBottomRef.current = distance <= NEAR_BOTTOM_PX
      maybePrefetchOlder()
    }
    onScroll()
    parent.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      parent.removeEventListener('scroll', onScroll)
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
            return (
              <div
                key={item.key}
                data-index={item.index}
                ref={virtualizer.measureElement}
                className="chat-virt-row absolute top-0 left-0 w-full"
                style={{ transform: `translateY(${item.start}px)` }}
              >
                <NodeViewMemo node={node} onInspect={onInspect} onFork={onFork} />
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {nodes.map((node) => (
            <NodeViewMemo key={node.id} node={node} onInspect={onInspect} onFork={onFork} />
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
