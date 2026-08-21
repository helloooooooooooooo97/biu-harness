import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { LuCheck, LuCopy, LuGitFork } from 'react-icons/lu'
import type { SlotProps } from '../../registry/slots.ts'
import { bindSessionView, type SessionViewService } from '../../infrastructure/session-view.ts'
import type { ChatNode } from '../../infrastructure/session-project.ts'
import { FishLogo } from '../brand.tsx'
import { MarkdownBody } from './markdown.tsx'
import { ToolCard } from './tool-card.tsx'

const NEAR_BOTTOM_PX = 96
const ROW_GAP_PX = 16
const ESTIMATE_ROW_PX = 160
/** 消息很少时全量渲染更简单，也避免虚表测量抖动 */
const VIRTUALIZE_AFTER = 12

function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null
  while (node) {
    const { overflowY } = getComputedStyle(node)
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') return node
    node = node.parentElement
  }
  return null
}

function AssistantActions({
  text,
  onFork,
}: {
  text: string
  onFork: () => void
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
    <div className="chat-assistant-actions" role="group" aria-label="消息操作">
      <button
        type="button"
        className={`chat-assistant-action${copied ? ' is-done' : ''}`}
        title={copied ? '已复制' : '复制'}
        aria-label={copied ? '已复制' : '复制回复'}
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
  onFork: () => void
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
  if (node.kind === 'assistant') {
    const streaming = Boolean(node.streaming)
    return (
      <div className="chat-assistant-row">
        <div className="chat-assistant-body">
          {node.text ? <MarkdownBody text={node.text} streaming={streaming} /> : streaming ? '…' : null}
          {streaming ? <span className="ml-1 inline-block animate-pulse text-[var(--dsw-label-3)]">▍</span> : null}
        </div>
        {!streaming && node.text.trim() ? <AssistantActions text={node.text} onFork={onFork} /> : null}
      </div>
    )
  }
  if (node.kind === 'tool') return <ToolCard node={node} onInspect={onInspect} />
  return <div className="self-center text-xs text-[var(--dsw-label-3)]">{node.text}</div>
}

const NodeViewMemo = memo(NodeView)

function EmptyHero() {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="dsw-hero-glow pointer-events-none absolute inset-0" />
      <div className="relative z-[1] flex flex-col items-center gap-3 text-center">
        <span className="dsw-fish-swim text-[var(--dsw-label)]">
          <FishLogo size={34} />
        </span>
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">How can I help you?</h2>
          <span className="rounded-full bg-[var(--dsw-hover)] px-2 py-0.5 text-[10px] font-semibold tracking-wider text-[var(--dsw-label-3)]">
            PREVIEW
          </span>
        </div>
        <p className="max-w-md text-sm text-[var(--dsw-label-3)]">
          对话由 append-only session 投影。输入框上方可绑定本机文件夹作为 Session cwd。
        </p>
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
  const error = useSessionView((state) => state.error)
  const hasMoreOlder = useSessionView((state) => state.hasMoreOlder)
  const loadingOlder = useSessionView((state) => state.loadingOlder)
  const rootRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLElement | null>(null)
  const stickToBottomRef = useRef(true)
  const [scrollEpoch, setScrollEpoch] = useState(0)

  const virtualize = nodes.length >= VIRTUALIZE_AFTER

  const onInspect = useCallback(
    (callId: string) => {
      sessionView.inspectCall(callId)
      if (sessionId) navigate(`/s/${sessionId}/trajectory`)
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

  const virtualizer = useVirtualizer({
    count: virtualize ? nodes.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATE_ROW_PX,
    overscan: 4,
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
    const onScroll = () => {
      const distance = parent.scrollHeight - parent.scrollTop - parent.clientHeight
      stickToBottomRef.current = distance <= NEAR_BOTTOM_PX
      if (parent.scrollTop <= NEAR_BOTTOM_PX && hasMoreOlder && !loadingOlder) {
        const beforeHeight = parent.scrollHeight
        const beforeTop = parent.scrollTop
        void sessionView.loadOlder().then((loaded) => {
          if (!loaded) return
          requestAnimationFrame(() => {
            parent.scrollTop = beforeTop + (parent.scrollHeight - beforeHeight)
          })
        })
      }
    }
    onScroll()
    parent.addEventListener('scroll', onScroll, { passive: true })
    return () => parent.removeEventListener('scroll', onScroll)
  }, [sessionId, scrollEpoch, virtualize, hasMoreOlder, loadingOlder, sessionView])

  const lastNode = nodes.at(-1)
  // 流式时按 ~96 字符步进 stickKey，避免每个 delta 都触发布局滚动
  const stickKey =
    lastNode?.kind === 'assistant'
      ? `${lastNode.id}:${lastNode.streaming ? Math.floor(lastNode.text.length / 96) : lastNode.text.length}:${lastNode.streaming ? 1 : 0}`
      : `${nodes.length}:${pending ? 1 : 0}:${error ?? ''}`

  useLayoutEffect(() => {
    if (!stickToBottomRef.current || nodes.length === 0) return
    const parent = scrollRef.current
    // 流式时直接改 scrollTop，避免 virtualizer.scrollToIndex 每帧重测布局
    if (parent) parent.scrollTop = parent.scrollHeight
  }, [stickKey, nodes.length])

  if (nodes.length === 0 && !pending && !error) return <EmptyHero />

  return (
    <div ref={rootRef} className="w-full" data-chat-virtual={virtualize ? '1' : '0'}>
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
                className="absolute top-0 left-0 w-full"
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
