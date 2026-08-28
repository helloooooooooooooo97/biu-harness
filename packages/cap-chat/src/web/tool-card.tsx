import { useMemo, useState } from 'react'
import { Image } from 'antd'
import {
  BugAntIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/16/solid'
import type { ChatToolPart } from '@biu/web-session-view'
import { pickDomAttrs } from '@biu/cap-pick/web'
import {
  diffStats,
  formatToolDetail,
  lineDiff,
  parseToolCall,
  prettyJsonString,
  shouldAutoOpenTool,
  toolSummary,
  toolTitle,
  type DiffLine,
  type FormattedDetail,
  type ParsedToolCall,
} from './tool-format.ts'

function DiffBlock({ lines, path }: { lines: DiffLine[]; path?: string }) {
  const stats = diffStats(lines)
  return (
    <div className="overflow-hidden rounded-[10px] border border-(--dsw-border) bg-(--dsw-surface)">
      {path ? (
        <div className="flex items-center justify-between gap-2 border-b border-(--dsw-border) bg-(--dsw-tool) px-3 py-1.5">
          <span className="min-w-0 truncate font-mono text-(length:--dsw-chat-ui-font-size) text-(--dsw-label-2)">{path}</span>
          <span className="shrink-0 font-mono text-(length:--dsw-chat-ui-font-size) tabular-nums text-(--dsw-label-3)">
            {stats.removed ? <span className="text-(--dsw-danger)">−{stats.removed}</span> : null}
            {stats.removed && stats.added ? ' ' : null}
            {stats.added ? <span className="text-(--dsw-ok)">+{stats.added}</span> : null}
          </span>
        </div>
      ) : null}
      <pre className="max-h-80 overflow-auto py-1 font-mono text-(length:--dsw-chat-ui-font-size) leading-5">
        {lines.map((line, index) => {
          const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '−' : ' '
          const rowClass =
            line.type === 'add'
              ? 'bg-[rgba(34,140,90,0.12)] text-[rgb(20,110,70)]'
              : line.type === 'remove'
                ? 'bg-[rgba(220,80,80,0.12)] text-[rgb(170,50,50)]'
                : 'text-(--dsw-label-2)'
          return (
            <div key={`${index}-${line.type}`} className={`flex whitespace-pre-wrap break-all px-2 ${rowClass}`}>
              <span className="w-4 shrink-0 select-none opacity-70">{prefix}</span>
              <span className="min-w-0 flex-1">{line.text || ' '}</span>
            </div>
          )
        })}
      </pre>
    </div>
  )
}

function ArtifactGallery({ artifacts }: { artifacts: NonNullable<Extract<FormattedDetail, { kind: 'bash' }>['artifacts']> }) {
  if (!artifacts.length) return null
  return (
    <Image.PreviewGroup>
      <div className="tool-artifacts" aria-label="Artifacts">
        {artifacts.map((item) => (
          <div key={item.url} className="tool-artifact">
            <Image
              className="tool-artifact-img"
              src={item.url}
              alt={item.name}
              loading="lazy"
              style={{ width: '100%', maxHeight: 220, objectFit: 'contain' }}
            />
            <span className="tool-artifact-caption">{item.source || item.name}</span>
          </div>
        ))}
      </div>
    </Image.PreviewGroup>
  )
}

function DetailView({ detail }: { detail: FormattedDetail }) {
  if (detail.kind === 'bash') {
    const hasOut = Boolean(detail.stdout)
    const hasErr = Boolean(detail.stderr)
    const artifacts = detail.artifacts ?? []
    return (
      <div className="space-y-2">
        <div className="overflow-hidden rounded-[10px] border border-(--dsw-border) bg-[#1e1f24]">
          <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-1.5">
            <span className="font-mono text-(length:--dsw-chat-ui-font-size) tracking-wide text-white/45 uppercase">output</span>
            <span
              className={`font-mono text-(length:--dsw-chat-ui-font-size) tabular-nums ${
                detail.code === 0 || detail.code == null ? 'text-[#7dcea0]' : 'text-[#f1948a]'
              }`}
            >
              exit {detail.code ?? '—'}
            </span>
          </div>
          <pre className="max-h-72 overflow-auto px-3 py-2 font-mono text-(length:--dsw-chat-ui-font-size) leading-5 text-[#e8eaed]">
            {hasOut ? <span className="whitespace-pre-wrap">{detail.stdout.replace(/\n$/, '')}</span> : null}
            {hasOut && hasErr ? '\n\n' : null}
            {hasErr ? <span className="whitespace-pre-wrap text-[#f5b7b1]">{detail.stderr.replace(/\n$/, '')}</span> : null}
            {!hasOut && !hasErr ? <span className="text-white/35">(empty)</span> : null}
          </pre>
        </div>
        <ArtifactGallery artifacts={artifacts} />
      </div>
    )
  }

  if (detail.kind === 'json') {
    return (
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-[10px] border border-(--dsw-border) bg-(--dsw-tool) px-3 py-2 font-mono text-(length:--dsw-chat-ui-font-size) leading-5 text-(--dsw-label-2)">
        {detail.text}
      </pre>
    )
  }

  return (
    <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-[10px] border border-(--dsw-border) bg-(--dsw-tool) px-3 py-2 font-mono text-(length:--dsw-chat-ui-font-size) leading-5 text-(--dsw-label)">
      {detail.text}
    </pre>
  )
}

function ToolBody({ parsed, rawArguments, detail }: { parsed: ParsedToolCall; rawArguments: string; detail?: string }) {
  const formatted = formatToolDetail(detail, parsed.kind)

  if (parsed.kind === 'str_replace') {
    const lines = lineDiff(parsed.oldStr, parsed.newStr)
    return (
      <div className="space-y-2">
        <DiffBlock path={parsed.path} lines={lines} />
        {formatted && formatted.kind === 'text' && !formatted.text.startsWith('The file ') ? (
          <DetailView detail={formatted} />
        ) : null}
      </div>
    )
  }

  if (parsed.kind === 'create') {
    const lines = lineDiff('', parsed.fileText)
    return (
      <div className="space-y-2">
        <DiffBlock path={parsed.path} lines={lines} />
        {formatted && formatted.kind === 'text' && !formatted.text.startsWith('File created') ? (
          <DetailView detail={formatted} />
        ) : null}
      </div>
    )
  }

  if (parsed.kind === 'insert') {
    const lines = lineDiff('', parsed.newStr)
    return (
      <div className="space-y-2">
        <DiffBlock path={`${parsed.path} · after line ${parsed.insertLine}`} lines={lines} />
        {formatted && formatted.kind === 'text' && !formatted.text.startsWith('The file ') ? (
          <DetailView detail={formatted} />
        ) : null}
      </div>
    )
  }

  if (parsed.kind === 'bash') {
    return (
      <div className="space-y-2">
        <pre className="overflow-x-auto rounded-[10px] border border-(--dsw-border) bg-[#1e1f24] px-3 py-2 font-mono text-(length:--dsw-chat-ui-font-size) leading-5 text-[#e8eaed]">
          <span className="text-[#8ab4f8]">$ </span>
          {parsed.command}
        </pre>
        {formatted ? <DetailView detail={formatted} /> : null}
      </div>
    )
  }

  if (parsed.kind === 'view') {
    return (
      <div className="space-y-2">
        <div className="font-mono text-(length:--dsw-chat-ui-font-size) text-(--dsw-label-3)">
          {parsed.path}
          {parsed.viewRange ? `:${parsed.viewRange[0]}-${parsed.viewRange[1]}` : ''}
        </div>
        {formatted ? <DetailView detail={formatted} /> : null}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {rawArguments ? (
        <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-[10px] border border-(--dsw-border) bg-(--dsw-tool) px-3 py-2 font-mono text-(length:--dsw-chat-ui-font-size) leading-5 text-(--dsw-label-2)">
          {prettyJsonString(rawArguments)}
        </pre>
      ) : null}
      {formatted ? <DetailView detail={formatted} /> : null}
    </div>
  )
}

export function ToolCard({
  node,
  onInspect,
  live = false,
}: {
  node: ChatToolPart
  onInspect: (callId: string) => void
  /** 所在回复仍在流式输出时，无 result 才算运行中 */
  live?: boolean
}) {
  const parsed = useMemo(() => parseToolCall(node.name, node.arguments), [node.name, node.arguments])
  const formatted = useMemo(
    () => formatToolDetail(node.result?.detail, parsed.kind),
    [node.result?.detail, parsed.kind],
  )
  const [open, setOpen] = useState(() => shouldAutoOpenTool(parsed, node.result?.detail))
  const summary = toolSummary(parsed, node.result?.detail?.slice(0, 80) || node.arguments.slice(0, 80) || '…')
  const title = toolTitle(parsed, node.name)
  const previewLines = useMemo(() => {
    if (parsed.kind !== 'str_replace' || open) return null
    return lineDiff(parsed.oldStr, parsed.newStr).filter((line) => line.type !== 'equal').slice(0, 4)
  }, [parsed, open])
  const collapsedArtifacts =
    !open && formatted?.kind === 'bash' && formatted.artifacts?.length ? formatted.artifacts : null

  const status = !node.result
    ? live
      ? {
          label: '运行中',
          className: 'tool-call-status is-running',
          icon: <ArrowPathIcon className="size-3.5 animate-spin" aria-hidden />,
        }
      : {
          label: '成功',
          className: 'tool-call-status is-ok',
          icon: <CheckCircleIcon className="size-3.5" aria-hidden />,
        }
    : node.result.ok
      ? {
          label: '成功',
          className: 'tool-call-status is-ok',
          icon: <CheckCircleIcon className="size-3.5" aria-hidden />,
        }
      : {
          label: '失败',
          className: 'tool-call-status is-fail',
          icon: <XCircleIcon className="size-3.5" aria-hidden />,
        }

  return (
    <div className="tool-call" {...pickDomAttrs('tool', node.callId, title)}>
      <div className={`tool-call-head${open ? ' is-open' : ''}`}>
        <button
          type="button"
          className="tool-call-toggle"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="tool-call-chevron" aria-hidden>
            {open ? <ChevronDownIcon className="size-3.5" /> : <ChevronRightIcon className="size-3.5" />}
          </span>
          <span className="tool-call-title">{title}</span>
          <span className="tool-call-summary">{summary}</span>
        </button>
        <span className={status.className} title={status.label} aria-label={status.label}>
          {status.icon}
        </span>
        <button
          type="button"
          className="tool-call-inspect"
          title="在轨迹中查看"
          aria-label="在轨迹中查看"
          onClick={() => onInspect(node.callId)}
        >
          <BugAntIcon className="size-3.5" aria-hidden />
        </button>
      </div>
      {!open && previewLines && previewLines.length > 0 ? (
        <div className="tool-call-body">
          <DiffBlock path={parsed.kind === 'str_replace' ? parsed.path : undefined} lines={previewLines} />
        </div>
      ) : null}
      {collapsedArtifacts ? (
        <div className="tool-call-body">
          <ArtifactGallery artifacts={collapsedArtifacts} />
        </div>
      ) : null}
      {open ? (
        <div className="tool-call-body">
          <ToolBody parsed={parsed} rawArguments={node.arguments} detail={node.result?.detail} />
        </div>
      ) : null}
    </div>
  )
}
