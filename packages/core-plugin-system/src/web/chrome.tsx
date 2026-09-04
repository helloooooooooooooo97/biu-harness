import { ArchiveBoxArrowDownIcon, PlayIcon, StopIcon } from '@heroicons/react/16/solid'
import { TagChip, TagChips } from '@biu/public-ui'
import { TrashGlyph } from '@biu/web-session-view/trash-glyph'
import { asHttpHref } from '@biu/type-file-system'
import type { CollectionChrome, FsActionProps, FsCellProps } from '@biu/type-file-system/ui'
import type { DbRecord } from '@biu/type-file-system'

function PluginTitle({ label }: { record: DbRecord; label: string }) {
  return <span className="truncate font-medium">{label}</span>
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
    <TagChips>
      {tags.map((tag) => (
        <TagChip key={tag} id={tag} label={tag} />
      ))}
    </TagChips>
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
    ) : action.id === 'pack' ? (
      <ArchiveBoxArrowDownIcon aria-hidden className="size-[14px]" />
    ) : null
  return (
    <button
      type="button"
      className={`tasks-icon-btn${action.tone === 'danger' ? ' is-danger' : ''}`}
      title={action.label}
      data-dock-tip={action.label}
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
