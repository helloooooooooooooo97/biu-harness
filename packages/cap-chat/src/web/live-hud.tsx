import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  CircleStackIcon,
  ClockIcon,
  HashtagIcon,
  Square3Stack3DIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/16/solid'
import type { SlotProps } from '@biu/web-slots'
import { bindSessionView } from '@biu/web-session-view'
import { UsageInline } from './usage-inline.tsx'
import { clipHudText, extractLiveHud, formatDuration, type LiveHudFlash } from './live-hud.ts'

function MetaItem({ icon, value, title }: { icon: ReactNode; value: ReactNode; title: string }) {
  return (
    <span className="chat-reply-meta-item" title={title}>
      <span className="chat-reply-meta-icon" aria-hidden>
        {icon}
      </span>
      <span className="chat-reply-meta-value">{value}</span>
    </span>
  )
}

export function ChatLiveMetrics(props: { useSessionView: ReturnType<typeof bindSessionView> }) {
  const nodes = props.useSessionView((state) => state.nodes)
  const agentStep = props.useSessionView((state) => state.agentStep)
  const hud = extractLiveHud(nodes, agentStep)
  if (!hud.turn && !hud.step && !hud.toolIndex && !hud.usage) return null
  return (
    <div className="chat-live-hud-metrics chat-reply-meta" data-testid="chat-live-hud" aria-live="polite">
      {hud.turn ? (
        <MetaItem icon={<HashtagIcon className="size-3" />} value={hud.turn} title={`第 ${hud.turn} 轮`} />
      ) : null}
      {hud.step ? (
        <MetaItem
          icon={<Square3Stack3DIcon className="size-3" />}
          value={hud.step}
          title={`本回合 ${hud.step} 个 step`}
        />
      ) : null}
      <MetaItem
        icon={<WrenchScrewdriverIcon className="size-3" />}
        value={<span data-testid="chat-live-hud-tool">{hud.toolIndex}</span>}
        title={`本回合 ${hud.toolIndex} 次工具调用`}
      />
      {hud.durationMs != null ? (
        <MetaItem
          icon={<ClockIcon className="size-3" />}
          value={formatDuration(hud.durationMs)}
          title="本回合耗时"
        />
      ) : null}
      {hud.usage ? (
        <MetaItem icon={<CircleStackIcon className="size-3" />} value={<UsageInline usage={hud.usage} />} title="Token 用量" />
      ) : null}
    </div>
  )
}

export const ChatLiveHud = memo(function ChatLiveHud(props: SlotProps) {
  const useSessionView = props.useSessionView as ReturnType<typeof bindSessionView>
  const nodes = useSessionView((state) => state.nodes)
  const agentStep = useSessionView((state) => state.agentStep)
  const hud = extractLiveHud(nodes, agentStep)
  const [flash, setFlash] = useState<LiveHudFlash | null>(null)
  const toolKey = hud.lastTool ? `${hud.lastTool.callId}:${hud.lastTool.result ? 'done' : 'call'}` : ''
  const outputKey = hud.streaming || !hud.lastOutput ? '' : `${hud.turn}:${hud.lastOutput.slice(0, 24)}`
  const seen = useRef({ tool: '', output: '' })

  useEffect(() => {
    if (!toolKey || toolKey === seen.current.tool) return
    seen.current.tool = toolKey
    const name = hud.lastTool?.name ?? 'tool'
    const label = hud.lastTool?.result
      ? `${name} ${hud.lastTool.result.ok ? '完成' : '失败'}`
      : `调用 ${name}`
    setFlash({ kind: 'tool', text: clipHudText(label, 72), key: toolKey })
  }, [toolKey, hud.lastTool])

  useEffect(() => {
    if (!outputKey || outputKey === seen.current.output) return
    seen.current.output = outputKey
    setFlash({ kind: 'output', text: clipHudText(hud.lastOutput, 220), key: outputKey })
  }, [outputKey, hud.lastOutput])

  if (!flash) return null
  return (
    <div className="chat-live-hud" data-testid="chat-live-hud-flash-wrap" aria-live="polite">
      <span className={`chat-live-hud-flash is-${flash.kind}`} data-testid="chat-live-hud-flash">
        {flash.text}
      </span>
    </div>
  )
})
