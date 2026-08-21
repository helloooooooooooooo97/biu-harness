import { useMemo, useState } from 'react'
import type { ChatToolPart } from '../../infrastructure/session-project.ts'
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
    <div className="overflow-hidden rounded-[10px] border border-[var(--dsw-border)] bg-[var(--dsw-surface)]">
      {path ? (
        <div className="flex items-center justify-between gap-2 border-b border-[var(--dsw-border)] bg-[var(--dsw-tool)] px-3 py-1.5">
          <span className="min-w-0 truncate font-mono text-[11px] text-[var(--dsw-label-2)]">{path}</span>
          <span className="shrink-0 font-mono text-[10px] tabular-nums text-[var(--dsw-label-3)]">
            {stats.removed ? <span className="text-[var(--dsw-danger)]">−{stats.removed}</span> : null}
            {stats.removed && stats.added ? ' ' : null}
            {stats.added ? <span className="text-[var(--dsw-ok)]">+{stats.added}</span> : null}
          </span>
        </div>
      ) : null}
      <pre className="max-h-80 overflow-auto py-1 font-mono text-[11px] leading-5">
        {lines.map((line, index) => {
          const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '−' : ' '
          const rowClass =
            line.type === 'add'
              ? 'bg-[rgba(34,140,90,0.12)] text-[rgb(20,110,70)]'
              : line.type === 'remove'
                ? 'bg-[rgba(220,80,80,0.12)] text-[rgb(170,50,50)]'
                : 'text-[var(--dsw-label-2)]'
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

function DetailView({ detail }: { detail: FormattedDetail }) {
  if (detail.kind === 'bash') {
    const hasOut = Boolean(detail.stdout)
    const hasErr = Boolean(detail.stderr)
    const artifacts = detail.artifacts ?? []
    return (
      <div className="space-y-2">
        <div className="overflow-hidden rounded-[10px] border border-[var(--dsw-border)] bg-[#1e1f24]">
          <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-1.5">
            <span className="font-mono text-[10px] tracking-wide text-white/45 uppercase">output</span>
            <span
              className={`font-mono text-[10px] tabular-nums ${
                detail.code === 0 || detail.code == null ? 'text-[#7dcea0]' : 'text-[#f1948a]'
              }`}
            >
              exit {detail.code ?? '—'}
            </span>
          </div>
          <pre className="max-h-72 overflow-auto px-3 py-2 font-mono text-[11px] leading-5 text-[#e8eaed]">
            {hasOut ? <span className="whitespace-pre-wrap">{detail.stdout.replace(/\n$/, '')}</span> : null}
            {hasOut && hasErr ? '\n\n' : null}
            {hasErr ? <span className="whitespace-pre-wrap text-[#f5b7b1]">{detail.stderr.replace(/\n$/, '')}</span> : null}
            {!hasOut && !hasErr ? <span className="text-white/35">(empty)</span> : null}
          </pre>
        </div>
        {artifacts.length > 0 ? (
          <div className="tool-artifacts" aria-label="Artifacts">
            {artifacts.map((item) => (
              <a key={item.url} className="tool-artifact" href={item.url} target="_blank" rel="noreferrer">
                <img className="tool-artifact-img" src={item.url} alt={item.name} loading="lazy" />
                <span className="tool-artifact-caption">{item.source || item.name}</span>
              </a>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  if (detail.kind === 'json') {
    return (
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-[10px] border border-[var(--dsw-border)] bg-[var(--dsw-tool)] px-3 py-2 font-mono text-[11px] leading-5 text-[var(--dsw-label-2)]">
        {detail.text}
      </pre>
    )
  }

  return (
    <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-[10px] border border-[var(--dsw-border)] bg-[var(--dsw-tool)] px-3 py-2 font-mono text-[11px] leading-5 text-[var(--dsw-label)]">
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
        <pre className="overflow-x-auto rounded-[10px] border border-[var(--dsw-border)] bg-[#1e1f24] px-3 py-2 font-mono text-[11px] leading-5 text-[#e8eaed]">
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
        <div className="font-mono text-[11px] text-[var(--dsw-label-3)]">
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
        <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-[10px] border border-[var(--dsw-border)] bg-[var(--dsw-tool)] px-3 py-2 font-mono text-[11px] leading-5 text-[var(--dsw-label-2)]">
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
}: {
  node: ChatToolPart
  onInspect: (callId: string) => void
}) {
  const parsed = useMemo(() => parseToolCall(node.name, node.arguments), [node.name, node.arguments])
  const [open, setOpen] = useState(() => shouldAutoOpenTool(parsed))
  const summary = toolSummary(parsed, node.result?.detail?.slice(0, 80) || node.arguments.slice(0, 80) || '…')
  const title = toolTitle(parsed, node.name)
  const previewLines = useMemo(() => {
    if (parsed.kind !== 'str_replace' || open) return null
    return lineDiff(parsed.oldStr, parsed.newStr).filter((line) => line.type !== 'equal').slice(0, 4)
  }, [parsed, open])

  return (
    <div className="w-full self-stretch">
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-[12px] px-2 py-1.5 text-left text-[13px] hover:bg-[var(--dsw-hover)]"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="grid size-4 place-items-center text-[10px] text-[var(--dsw-label-3)]">{open ? '▾' : '▸'}</span>
          <span className="font-medium text-[var(--dsw-label)]">{title}</span>
          <span className="text-[var(--dsw-label-3)]">·</span>
          <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-[var(--dsw-label-3)]">{summary}</span>
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
          Debug
        </button>
      </div>
      {!open && previewLines && previewLines.length > 0 ? (
        <div className="mt-1 px-2">
          <DiffBlock path={parsed.kind === 'str_replace' ? parsed.path : undefined} lines={previewLines} />
        </div>
      ) : null}
      {open ? (
        <div className="mt-1 px-2">
          <ToolBody parsed={parsed} rawArguments={node.arguments} detail={node.result?.detail} />
        </div>
      ) : null}
    </div>
  )
}
