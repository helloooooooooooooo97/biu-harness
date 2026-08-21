import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { SlotProps } from '../../registry/slots.ts'
import { bindSessionView, type SessionViewService } from '../../infrastructure/session-view.ts'
import type { ChatNode } from '../../infrastructure/session-project.ts'
import { FishLogo } from '../brand.tsx'
import { MarkdownBody } from './markdown.tsx'

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

function ToolRow({
  node,
  onInspect,
}: {
  node: Extract<ChatNode, { kind: 'tool' }>
  onInspect: (callId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const summary = node.result?.detail?.slice(0, 80) || node.arguments.slice(0, 80) || '…'
  return (
    <div className="w-full max-w-[var(--dsw-chat-width)] self-stretch">
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-[12px] px-2 py-1.5 text-left text-[13px] hover:bg-black/[0.03]"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="grid size-4 place-items-center text-[10px] text-[var(--dsw-label-3)]">{open ? '▾' : '▸'}</span>
          <span className="font-medium">{node.name}</span>
          <span className="text-[var(--dsw-label-3)]">·</span>
          <span className="min-w-0 flex-1 truncate text-[var(--dsw-label-3)]">{summary}</span>
          {node.result ? (
            <span className={node.result.ok ? 'text-[var(--dsw-ok)]' : 'text-[var(--dsw-danger)]'}>
              {node.result.ok ? 'ok' : 'fail'}
            </span>
          ) : (
            <span className="text-[var(--dsw-label-3)]">running</span>
          )}
        </button>
        <button
          type="button"
          className="shrink-0 rounded-[8px] px-2 py-1 text-[11px] text-[var(--dsw-business)] hover:bg-[var(--dsw-business-soft)]"
          onClick={() => onInspect(node.callId)}
        >
          Trajectory
        </button>
      </div>
      {open ? (
        <div className="mt-1 space-y-2 rounded-[12px] border border-[var(--dsw-border)] bg-[var(--dsw-tool)] p-3 font-mono text-xs">
          {node.arguments ? <pre className="whitespace-pre-wrap text-[var(--dsw-label-2)]">{node.arguments}</pre> : null}
          {node.result?.detail ? <pre className="whitespace-pre-wrap">{node.result.detail}</pre> : null}
        </div>
      ) : null}
    </div>
  )
}

function NodeView({ node, onInspect }: { node: ChatNode; onInspect: (callId: string) => void }) {
  if (node.kind === 'user') {
    return (
      <div className="flex w-full justify-end">
        <div
          className="max-w-[525px] px-4 py-3 text-[15px] leading-6 text-[var(--dsw-label)]"
          style={{ background: 'var(--dsw-bubble)', borderRadius: 'var(--dsw-radius-bubble)' }}
        >
          {node.kindTag === 'inject' ? <div className="mb-1 text-[10px] text-[var(--dsw-label-3)]">inject</div> : null}
          <MarkdownBody text={node.text} />
        </div>
      </div>
    )
  }
  if (node.kind === 'assistant') {
    return (
      <div className="w-full max-w-[var(--dsw-chat-width)] self-start text-[15px] leading-7 text-[var(--dsw-label)]">
        {node.text ? <MarkdownBody text={node.text} streaming={Boolean(node.streaming)} /> : node.streaming ? '…' : null}
        {node.streaming ? <span className="ml-1 inline-block animate-pulse text-[var(--dsw-label-3)]">▍</span> : null}
      </div>
    )
  }
  if (node.kind === 'tool') return <ToolRow node={node} onInspect={onInspect} />
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
          <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-[var(--dsw-label-3)]">
            PREVIEW
          </span>
        </div>
        <p className="max-w-md text-sm text-[var(--dsw-label-3)]">
          对话由 append-only session 投影。右侧 Project 可为本 Session 打开本地文件夹并编辑文件。
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
        className={`size-2 rounded-full ${agentStatus === 'running' ? 'bg-[var(--dsw-ok)]' : 'bg-black/20'}`}
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
    <div ref={rootRef} className="mx-auto w-full max-w-[var(--dsw-chat-width)]" data-chat-virtual={virtualize ? '1' : '0'}>
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
                <NodeViewMemo node={node} onInspect={onInspect} />
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {nodes.map((node) => (
            <NodeViewMemo key={node.id} node={node} onInspect={onInspect} />
          ))}
        </div>
      )}
      {error ? (
        <div className="mt-4 rounded-[12px] bg-red-50 px-3 py-2 text-sm text-[var(--dsw-danger)]">{error}</div>
      ) : null}
    </div>
  )
})

export function chatThreadProps(view: SessionViewService) {
  return { useSessionView: bindSessionView(view) }
}
