import type { SlotProps } from '../../registry/slots.ts'
import { bindSessionView, type SessionViewService } from '../../infrastructure/session-view.ts'
import type { ChatNode } from '../../infrastructure/session-project.ts'

function ToolCard({ node }: { node: Extract<ChatNode, { kind: 'tool' }> }) {
  return (
    <div className="mr-6 self-stretch rounded-xl border border-[#3c4043] bg-[#18191a] px-3 py-2 text-xs">
      <div className="mb-1 flex items-center gap-2 text-[#c4c7c5]">
        <span className="rounded bg-[#2d2e30] px-1.5 py-0.5 font-mono text-[10px] tracking-wide uppercase">tool</span>
        <span className="font-medium text-[#e8eaed]">{node.name}</span>
        {node.result ? (
          <span className={node.result.ok ? 'text-[#86efac]' : 'text-[#fca5a5]'}>{node.result.ok ? 'ok' : 'fail'}</span>
        ) : (
          <span className="text-[#9aa0a6]">running…</span>
        )}
      </div>
      {node.arguments ? (
        <pre className="mb-1 overflow-x-auto whitespace-pre-wrap text-[#9aa0a6]">{node.arguments}</pre>
      ) : null}
      {node.result?.detail ? (
        <pre className="overflow-x-auto whitespace-pre-wrap text-[#e8eaed]">{node.result.detail}</pre>
      ) : null}
    </div>
  )
}

function NodeView({ node }: { node: ChatNode }) {
  if (node.kind === 'user') {
    return (
      <div className="ml-10 self-end rounded-2xl bg-[#4d6bfe] px-4 py-3 text-sm text-white">
        {node.kindTag === 'inject' ? <div className="mb-1 text-[10px] opacity-80">inject</div> : null}
        {node.text}
      </div>
    )
  }
  if (node.kind === 'assistant') {
    return (
      <div className="mr-10 self-start rounded-2xl bg-[#2d2e30] px-4 py-3 text-sm leading-6">
        {node.text || (node.streaming ? '…' : '')}
        {node.streaming ? <span className="ml-1 inline-block animate-pulse text-[#9aa0a6]">▍</span> : null}
      </div>
    )
  }
  if (node.kind === 'tool') return <ToolCard node={node} />
  return <div className="self-center text-xs text-[#9aa0a6]">{node.text}</div>
}

export function ChatThread(props: SlotProps) {
  const useSessionView = props.useSessionView as ReturnType<typeof bindSessionView>
  const nodes = useSessionView((state) => state.nodes)
  const pending = useSessionView((state) => state.pending)
  const agentStatus = useSessionView((state) => state.agentStatus)
  const agentStep = useSessionView((state) => state.agentStep)
  const error = useSessionView((state) => state.error)
  const sessionId = useSessionView((state) => state.sessionId)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-xs text-[#9aa0a6]">
        <span
          className={`size-2 rounded-full ${agentStatus === 'running' ? 'bg-[#86efac]' : 'bg-[#5f6368]'}`}
          aria-hidden
        />
        <span>{agentStatus === 'running' ? `agent running${agentStep != null ? ` · step ${agentStep}` : ''}` : 'agent idle'}</span>
        {sessionId ? <span className="font-mono text-[10px] opacity-70">{sessionId.slice(0, 8)}</span> : null}
      </div>
      {nodes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#3c4043] px-4 py-8 text-center text-sm text-[#9aa0a6]">
          对话由 append-only session 投影。发送一条消息开始。
        </div>
      ) : (
        nodes.map((node) => <NodeView key={node.id} node={node} />)
      )}
      {pending && agentStatus === 'running' ? (
        <div className="mr-10 self-start text-sm text-[#9aa0a6]">turn in progress…</div>
      ) : null}
      {error ? <div className="self-stretch rounded-xl bg-[#3f1d1d] px-3 py-2 text-sm text-[#fca5a5]">{error}</div> : null}
    </div>
  )
}

export function chatThreadProps(view: SessionViewService) {
  return { useSessionView: bindSessionView(view) }
}
