import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
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

/**
 * 消息列表：会话内全部挂在 DOM 上（不虚表卸行）。
 * 屏外绘制交给 CSS content-visibility；来回滑不会整行 remount。
 * 导出供回归测试断言「跳回不重新挂载」。
 */
export function ChatNodeList({
  nodes,
  onInspect,
  onFork,
}: {
  nodes: ChatNode[]
  onInspect: (callId: string) => void
  onFork: () => void | Promise<void>
}) {
  return (
    <div className="chat-node-list flex flex-col gap-4">
      {nodes.map((node) => (
        <div key={node.id} className="chat-msg-row" data-node-id={node.id}>
          <NodeViewMemo node={node} onInspect={onInspect} onFork={onFork} />
        </div>
      ))}
    </div>
  )
}

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
  if (agentStatus !== 'running') return null
  return (
    <div className="mb-4 flex items-center gap-2 text-xs text-[var(--dsw-label-3)]">
      <span className="inline-block size-1.5 animate-pulse rounded-full bg-[var(--dsw-ok)]" />
      Running{agentStep != null ? ` · step ${agentStep + 1}` : ''}
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
  const [scrollEpoch, setScrollEpoch] = useState(0)

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

  useLayoutEffect(() => {
    const parent = findScrollParent(rootRef.current)
    if (parent && parent !== scrollRef.current) {
      scrollRef.current = parent
      setScrollEpoch((value) => value + 1)
    }
  }, [sessionId])

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
  }, [sessionId, scrollEpoch, hasMoreOlder, loadingOlder, sessionView])

  const lastNode = nodes.at(-1)
  const stickKey =
    lastNode?.kind === 'reply' && lastNode.streaming
      ? `${lastNode.id}:${Math.floor(lastNode.copyText.length / 96)}:1`
      : `${nodes.length}:${pending ? 1 : 0}:${error ?? ''}`

  useLayoutEffect(() => {
    if (!stickToBottomRef.current || nodes.length === 0) return
    const parent = scrollRef.current
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
      data-chat-virtual="0"
      data-switching={switchingSession ? '1' : undefined}
      style={switchingSession ? { opacity: 0.72, transition: 'opacity 120ms ease' } : undefined}
    >
      <StatusRow agentStatus={agentStatus} agentStep={agentStep} />
      {loadingOlder ? (
        <div className="mb-3 text-center text-[11px] text-[var(--dsw-label-3)]">加载更早消息…</div>
      ) : null}
      <ChatNodeList nodes={nodes} onInspect={onInspect} onFork={onFork} />
      {error ? (
        <div className="mt-4 rounded-[12px] bg-[var(--dsw-danger-soft)] px-3 py-2 text-sm text-[var(--dsw-danger)]">{error}</div>
      ) : null}
    </div>
  )
})

export function chatThreadProps(view: SessionViewService) {
  return { useSessionView: bindSessionView(view) }
}
