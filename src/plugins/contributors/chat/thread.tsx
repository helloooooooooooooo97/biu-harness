import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { SlotProps } from '../../registry/slots.ts'
import { bindSessionView, type SessionViewService } from '../../infrastructure/session-view.ts'
import type { ChatNode } from '../../infrastructure/session-project.ts'
import { FishLogo } from '../brand.tsx'
import { MarkdownBody } from './markdown.tsx'

const NEAR_BOTTOM_PX = 96

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
        {node.text ? <MarkdownBody text={node.text} /> : node.streaming ? '…' : null}
        {node.streaming ? <span className="ml-1 inline-block animate-pulse text-[var(--dsw-label-3)]">▍</span> : null}
      </div>
    )
  }
  if (node.kind === 'tool') return <ToolRow node={node} onInspect={onInspect} />
  return <div className="self-center text-xs text-[var(--dsw-label-3)]">{node.text}</div>
}

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

export function ChatThread(props: SlotProps) {
  const useSessionView = props.useSessionView as ReturnType<typeof bindSessionView>
  const sessionView = props.sessionView as SessionViewService
  const navigate = useNavigate()
  const nodes = useSessionView((state) => state.nodes)
  const pending = useSessionView((state) => state.pending)
  const agentStatus = useSessionView((state) => state.agentStatus)
  const agentStep = useSessionView((state) => state.agentStep)
  const sessionId = useSessionView((state) => state.sessionId)
  const error = useSessionView((state) => state.error)
  const endRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)

  useEffect(() => {
    stickToBottomRef.current = true
  }, [sessionId])

  useEffect(() => {
    if (pending) stickToBottomRef.current = true
  }, [pending])

  useEffect(() => {
    const end = endRef.current
    const parent = findScrollParent(end)
    if (!parent) return
    const onScroll = () => {
      const distance = parent.scrollHeight - parent.scrollTop - parent.clientHeight
      stickToBottomRef.current = distance <= NEAR_BOTTOM_PX
    }
    onScroll()
    parent.addEventListener('scroll', onScroll, { passive: true })
    return () => parent.removeEventListener('scroll', onScroll)
  }, [sessionId, nodes.length])

  useLayoutEffect(() => {
    if (!stickToBottomRef.current) return
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [nodes, pending, error, agentStatus, agentStep])

  if (nodes.length === 0 && !pending && !error) return <EmptyHero />

  return (
    <div className="mx-auto flex w-full max-w-[var(--dsw-chat-width)] flex-col gap-4">
      <div className="flex items-center gap-2 text-xs text-[var(--dsw-label-3)]">
        <span
          className={`size-2 rounded-full ${agentStatus === 'running' ? 'bg-[var(--dsw-ok)]' : 'bg-black/20'}`}
          aria-hidden
        />
        <span>{agentStatus === 'running' ? `Running${agentStep != null ? ` · step ${agentStep}` : ''}` : 'Idle'}</span>
      </div>
      {nodes.map((node) => (
        <NodeView
          key={node.id}
          node={node}
          onInspect={(callId) => {
            sessionView.inspectCall(callId)
            if (sessionId) navigate(`/s/${sessionId}/trajectory`)
          }}
        />
      ))}
      {error ? (
        <div className="rounded-[12px] bg-red-50 px-3 py-2 text-sm text-[var(--dsw-danger)]">{error}</div>
      ) : null}
      <div ref={endRef} aria-hidden className="h-px w-full shrink-0" />
    </div>
  )
}

export function chatThreadProps(view: SessionViewService) {
  return { useSessionView: bindSessionView(view) }
}
