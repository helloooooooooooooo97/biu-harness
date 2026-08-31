import { PlayIcon, StopIcon } from '@heroicons/react/16/solid'
import { TrashGlyph } from '@biu/web-session-view/trash-glyph'
import { asHttpHref } from '@biu/type-file-system'
import type { CollectionChrome, FsActionProps, FsCellProps } from '@biu/type-file-system/ui'
import type { DbRecord } from '@biu/type-file-system'

function PluginTitle({ record, label }: { record: DbRecord; label: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className="truncate font-medium">{label}</span>
      {record.hasHost ? (
        <span className="shrink-0 rounded px-1 text-[10px] font-semibold tracking-wide text-(--dsw-label-3)">Host</span>
      ) : null}
      {record.hasWeb ? (
        <span className="shrink-0 rounded px-1 text-[10px] font-semibold tracking-wide text-(--dsw-label-3)">Web</span>
      ) : null}
    </span>
  )
}

function PluginAuthorCell({ record, fallback }: FsCellProps) {
  const name = fallback === '—' ? '' : fallback
  const href = asHttpHref(record.authorUrl)
  if (!name && !href) return <span className="text-(--dsw-label-3)">—</span>
  if (!href) return <span>{name || '—'}</span>
  return (
    <a
      className="min-w-0 truncate text-(--dsw-accent) underline-offset-2 hover:underline"
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => event.stopPropagation()}
    >
      {name || href}
    </a>
  )
}

function PluginTagsCell({ value, fallback }: FsCellProps) {
  const tags = Array.isArray(value) ? value.map(String) : fallback === '—' ? [] : fallback.split(', ')
  if (!tags.length) return <span className="text-(--dsw-label-3)">—</span>
  return (
    <span className="inline-flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span key={tag} className="rounded-full bg-(--dsw-hover) px-1.5 py-0.5 text-[11px] text-(--dsw-label)">
          #{tag}
        </span>
      ))}
    </span>
  )
}

function PluginAction({ action, busy, run }: FsActionProps) {
  const icon =
    action.id === 'start' ? (
      <PlayIcon aria-hidden className="size-[14px]" />
    ) : action.id === 'stop' ? (
      <StopIcon aria-hidden className="size-[14px]" />
    ) : action.id === 'uninstall' ? (
      <TrashGlyph aria-hidden className="size-[14px]" />
    ) : null
  return (
    <button
      type="button"
      className={`tasks-icon-btn${action.tone === 'danger' ? ' is-danger' : ''}`}
      title={action.label}
      aria-label={action.label}
      disabled={busy}
      onClick={run}
    >
      {icon ?? action.label}
    </button>
  )
}

export const pluginsChrome: CollectionChrome = {
  cells: {
    author: PluginAuthorCell,
    tags: PluginTagsCell,
  },
  Title: PluginTitle,
  Action: PluginAction,
}
