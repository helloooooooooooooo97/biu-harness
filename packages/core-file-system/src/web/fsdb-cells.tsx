import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { BoolBox, TagChip, TagChips } from '@biu/public-ui'
import {
  ArchiveBoxArrowDownIcon,
  ArrowPathIcon,
  Bars3BottomLeftIcon,
  CalendarDaysIcon,
  CheckIcon,
  DocumentTextIcon,
  HashtagIcon,
  LinkIcon,
  ListBulletIcon,
  PaperClipIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  PhotoIcon,
  PlayIcon,
  RectangleStackIcon,
  StopIcon,
  TableCellsIcon,
  ShareIcon,
} from '@heroicons/react/16/solid'
import { TrashGlyph } from '@biu/web-session-view/trash-glyph'
import type { CollectionSchema, DbRecord, FieldSpec, FieldType } from '@biu/type-file-system'
import { actionVisibleToUser, asAttachment, asHttpHref, asImageSrc } from '@biu/type-file-system'
import type { CollectionViewType } from '@biu/type-file-system/ui'
import {
  asStringList,
  formatField,
  matchActionWhen,
  resolveFieldType,
  type ViewMode,
} from './fields.ts'
import { LocalText, TokenMultiSelect } from './controls.tsx'
import { CellDateTime } from '@biu/database-ui'
import { MediaField } from './cell-media.tsx'

export function actionIcon(id: string) {
  const cls = 'size-[14px]'
  if (id === 'start' || id === 'play' || id === 'run' || id === 'open') return <PlayIcon aria-hidden className={cls} />
  if (id === 'stop' || id === 'close' || id === 'pause') return <StopIcon aria-hidden className={cls} />
  if (id === 'pack') return <ArchiveBoxArrowDownIcon aria-hidden className={cls} />
  if (id === 'uninstall' || id === 'delete' || id === 'remove') return <TrashGlyph aria-hidden className={cls} />
  if (id === 'edit' || id === 'rename') return <PencilSquareIcon aria-hidden className={cls} />
  if (id === 'refresh') return <ArrowPathIcon aria-hidden className={cls} />
  if (id === 'deliver') return <PaperAirplaneIcon aria-hidden className={cls} />
  return null
}

export function ModeGlyph({ id, extra }: { id: ViewMode; extra?: CollectionViewType[] }) {
  const cls = 'size-[14px]'
  const Custom = extra?.find((item) => item.id === id)?.Icon
  if (Custom) return <Custom className={cls} />
  if (id === 'table') return <TableCellsIcon aria-hidden className={cls} />
  return <ShareIcon aria-hidden className={cls} />
}

export const VIEW_MODES: Array<{ id: ViewMode; label: string }> = [
  { id: 'table', label: '表格' },
]

export function fieldDraftValue(field: FieldSpec, value: unknown): string {
  const kind = resolveFieldType(field)
  if (kind === 'multi-select') return asStringList(value).join(', ')
  if (kind === 'boolean') return value === true || value === 'true' ? 'true' : 'false'
  if (kind === 'url') return asHttpHref(value)
  if (kind === 'image') return asImageSrc(value)
  if (kind === 'attachment') return asAttachment(value)?.href ?? ''
  if (kind === 'file') {
    if (value == null || value === '') return ''
    if (typeof value === 'string') return value
    return JSON.stringify(value, null, 2)
  }
  if (value == null) return ''
  return String(value)
}

export function draftFromRecord(schema: CollectionSchema, row: DbRecord, bodyKey: string | null | undefined, detailBody: unknown) {
  const next: Record<string, string> = {}
  for (const [key, field] of Object.entries(schema.fields)) {
    const value = key === bodyKey ? detailBody : row[key]
    next[key] = fieldDraftValue(field, value)
  }
  return next
}

export function FieldGlyph({ kind }: { kind: FieldType }) {
  const cls = 'size-[14px] shrink-0 opacity-80'
  if (kind === 'boolean') return <span aria-hidden className="fsdb-field-bool-glyph"><BoolBox on={false} /></span>
  if (kind === 'select') return <ListBulletIcon aria-hidden className={cls} />
  if (kind === 'multi-select') return <RectangleStackIcon aria-hidden className={cls} />
  if (kind === 'datetime') return <CalendarDaysIcon aria-hidden className={cls} />
  if (kind === 'number') return <HashtagIcon aria-hidden className={cls} />
  if (kind === 'url') return <LinkIcon aria-hidden className={cls} />
  if (kind === 'image') return <PhotoIcon aria-hidden className={cls} />
  if (kind === 'attachment') return <PaperClipIcon aria-hidden className={cls} />
  if (kind === 'file') return <DocumentTextIcon aria-hidden className={cls} />
  if (kind === 'facet') return <RectangleStackIcon aria-hidden className={cls} />
  if (kind === 'action') return <PlayIcon aria-hidden className={cls} />
  return <Bars3BottomLeftIcon aria-hidden className={cls} />
}

export function BoolCell({
  on,
  writable,
  onToggle,
}: {
  on: boolean
  writable?: boolean
  onToggle?: () => void
}) {
  const mark = (
    <BoolBox on={on} locked={!writable}>
      {on ? <CheckIcon aria-hidden className="size-3" /> : null}
    </BoolBox>
  )
  if (!writable || !onToggle) {
    return (
      <span className="fsdb-bool" title={on ? '是' : '否'}>
        {mark}
      </span>
    )
  }
  return (
    <button
      type="button"
      className="fsdb-boolbtn"
      aria-pressed={on}
      aria-label={on ? '是' : '否'}
      title={on ? '是，点击改为否' : '否，点击改为是'}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
    >
      {mark}
    </button>
  )
}

function ImageThumb({ src }: { src: string }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
  return (
    <>
      <button
        type="button"
        className="fsdb-thumb-btn"
        title="查看大图"
        onClick={(event) => {
          event.stopPropagation()
          setOpen(true)
        }}
      >
        <img className="fsdb-thumb" src={src} alt="" decoding="async" width={28} height={18} />
      </button>
      {open
        ? createPortal(
            <div
              className="fsdb-lightbox"
              role="dialog"
              aria-modal="true"
              aria-label="查看图片"
              onMouseDown={(event) => {
                event.stopPropagation()
                if (event.target === event.currentTarget) setOpen(false)
              }}
            >
              <img src={src} alt="" decoding="async" onClick={(event) => event.stopPropagation()} />
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

export function parseFieldValue(field: FieldSpec, raw: string): unknown {
  const kind = resolveFieldType(field)
  if (kind === 'boolean') return raw === 'true'
  if (kind === 'number' || kind === 'datetime') return raw === '' ? null : Number(raw)
  if (kind === 'multi-select') return asStringList(raw)
  if (kind === 'facet') {
    const trimmed = raw.trim()
    if (!trimmed) return { tags: [], values: {} }
    try {
      return JSON.parse(trimmed) as unknown
    } catch {
      return { tags: [], values: {} }
    }
  }
  if (kind === 'file' || kind === 'attachment' || kind === 'image') {
    const trimmed = raw.trim()
    if (!trimmed) return kind === 'file' ? null : ''
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return JSON.parse(trimmed) as unknown
      } catch {
        return raw
      }
    }
    return raw
  }
  return raw
}

function previewImageSrc(kind: FieldType | undefined, value: unknown): string {
  if (kind === 'attachment' || kind === 'url') return ''
  const src = asImageSrc(value)
  if (!src) return ''
  if (kind === 'image' || !kind) return src
  if (/^data:image\//i.test(src)) return src
  if (/\.(?:png|jpe?g|gif|webp|svg|avif|bmp)(?:[?#]|$)/i.test(src)) return src
  return ''
}

export function FilePreview({
  value,
  compact = false,
  kind,
}: {
  value: unknown
  compact?: boolean
  kind?: FieldType
}) {
  if (value == null || value === '') return <span className="fsdb-muted">—</span>
  const src = previewImageSrc(kind, value)
  if (src) {
    if (compact) return <ImageThumb src={src} />
    return <img className="fsdb-fileview-img" src={src} alt="" decoding="async" />
  }
  const file = asAttachment(value)
  if (file) {
    return (
      <a className="fsdb-file" href={file.href} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
        <PaperClipIcon aria-hidden className="size-[14px] shrink-0" />
        <span className="fsdb-file-name">{file.name}</span>
      </a>
    )
  }
  const href = asHttpHref(value)
  if (href && typeof value !== 'object') {
    return (
      <a className="fsdb-link" href={href} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
        {href}
      </a>
    )
  }
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, compact ? 0 : 2)
  if (compact) return <span className="fsdb-meta">{text.length > 80 ? `${text.slice(0, 80)}…` : text}</span>
  return <pre className="fsdb-fileview-pre">{text || '—'}</pre>
}

export function DefaultCell({ field, value, fieldKey, onRun }: { field: FieldSpec; value: unknown; fieldKey?: string; onRun?: () => void }) {
  const kind = resolveFieldType(field)
  if (kind === 'action') {
    return <ActionCell field={field} fieldKey={fieldKey ?? ''} onRun={onRun} />
  }
  if (kind === 'select' || kind === 'multi-select') {
    const tags = kind === 'multi-select' ? asStringList(value) : String(value ?? '') ? [String(value)] : []
    if (!tags.length) return <span className="fsdb-muted">—</span>
    return (
      <TagChips>
        {tags.map((tag) => (
          <TagChip key={tag} id={tag} label={tag} />
        ))}
      </TagChips>
    )
  }
  if (kind === 'url' || kind === 'image' || kind === 'attachment' || kind === 'file') {
    return <FilePreview value={value} compact kind={kind} />
  }
  const text = formatField(field, value)
  return <span className={kind === 'datetime' ? 'fsdb-meta' : undefined}>{text}</span>
}

export function fieldActionId(fieldKey: string, field: FieldSpec) {
  return String(field.action ?? fieldKey).trim() || fieldKey
}

export function ActionCell({
  field,
  fieldKey,
  onRun,
}: {
  field: FieldSpec
  fieldKey: string
  onRun?: () => void
}) {
  const label = field.label || fieldKey
  return (
    <button
      type="button"
      className="fsdb-action-btn"
      title={label}
      data-dock-tip={label}
      onClick={(event) => {
        event.stopPropagation()
        onRun?.()
      }}
    >
      {label}
    </button>
  )
}

export function FieldEditor({
  fieldKey,
  field,
  value,
  onChange,
  options,
  onAction,
  autoOpen = false,
  collectionPath,
  source,
  onCommit,
  compact = false,
}: {
  fieldKey: string
  field: FieldSpec
  value: string
  onChange: (next: string) => void
  options?: string[]
  onAction?: () => void
  autoOpen?: boolean
  collectionPath?: string
  source?: unknown
  onCommit?: (next: unknown) => void
  compact?: boolean
}) {
  const kind = resolveFieldType(field)
  if (kind === 'action') {
    return <ActionCell field={field} fieldKey={fieldKey} onRun={onAction} />
  }
  if (kind === 'select' || kind === 'multi-select') {
    const selected = kind === 'multi-select' ? asStringList(value) : value ? [value] : []
    const list = [...new Set([...(options ?? []), ...selected])].filter(Boolean)
    return (
      <TokenMultiSelect
        values={selected}
        options={list}
        multiple={kind === 'multi-select'}
        autoOpen={autoOpen}
        onChange={(next) => onChange(kind === 'multi-select' ? next.join(', ') : (next[0] ?? ''))}
      />
    )
  }
  if (kind === 'boolean') {
    return <BoolCell on={value === 'true'} writable onToggle={() => onChange(value === 'true' ? 'false' : 'true')} />
  }
  if (kind === 'datetime') {
    return (
      <CellDateTime
        value={value}
        onChange={(next) => onChange(next == null ? '' : String(next))}
      />
    )
  }
  if (kind === 'url' || kind === 'image' || kind === 'attachment') {
    return (
      <MediaField
        kind={kind}
        value={source ?? value}
        collectionPath={collectionPath}
        compact={compact}
        onCommit={(next) => {
          if (onCommit) onCommit(next)
          else onChange(typeof next === 'string' ? next : JSON.stringify(next))
        }}
      />
    )
  }
  return <LocalText className="fsdb-plain-input" value={value} title={value} placeholder="" onCommit={onChange} />
}

export function visibleActions(schema: CollectionSchema | undefined, row: DbRecord, place: 'row' | 'detail') {
  return (schema?.actions ?? []).filter((action) => {
    if (!actionVisibleToUser(action)) return false
    const places = action.placement ?? ['row', 'detail']
    return places.includes(place) && matchActionWhen(row, action.when)
  })
}
