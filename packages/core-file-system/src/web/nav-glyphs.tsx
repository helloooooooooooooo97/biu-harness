import {
  CircleStackIcon,
  ClipboardDocumentListIcon,
  ChatBubbleLeftRightIcon,
  BoltIcon,
  DocumentIcon,
  EyeIcon,
  ListBulletIcon,
  PuzzlePieceIcon,
  Squares2X2Icon,
  TableCellsIcon,
  ViewColumnsIcon,
} from '@heroicons/react/16/solid'
import type { ViewMode } from './fields.ts'
import type { CrumbKind } from './sidebar-nav.ts'

export function TableGlyph({ icon, className = 'size-4' }: { icon?: string; className?: string }) {
  const name = (icon ?? '').trim().toLowerCase()
  if (name === 'puzzle-piece' || name === 'puzzle') return <PuzzlePieceIcon aria-hidden className={className} />
  if (name === 'clipboard-document-list' || name === 'clipboard') return <ClipboardDocumentListIcon aria-hidden className={className} />
  if (name === 'chat-bubble' || name === 'chat-bubble-left-right') return <ChatBubbleLeftRightIcon aria-hidden className={className} />
  if (name === 'document' || name === 'document-text' || name === 'page') return <DocumentIcon aria-hidden className={className} />
  if (name === 'bolt') return <BoltIcon aria-hidden className={className} />
  if (name === 'eye') return <EyeIcon aria-hidden className={className} />
  return <TableCellsIcon aria-hidden className={className} />
}

export function ViewModeGlyph({ mode, className = 'size-4' }: { mode?: ViewMode; className?: string }) {
  if (mode === 'queue') return <ListBulletIcon aria-hidden className={className} />
  if (mode === 'table') return <TableCellsIcon aria-hidden className={className} />
  if (mode === 'cards') return <Squares2X2Icon aria-hidden className={className} />
  if (mode === 'board') return <ViewColumnsIcon aria-hidden className={className} />
  return <Squares2X2Icon aria-hidden className={className} />
}

export function CrumbItemGlyph({
  kind,
  icon,
  mode,
  emoji: _emoji,
  className = 'chat-view-project-icon',
}: {
  kind: CrumbKind
  icon?: string
  mode?: ViewMode
  emoji?: string
  className?: string
}) {
  if (kind === 'record') return <TableGlyph icon={icon} className={className} />
  if (kind === 'view') return <ViewModeGlyph mode={mode} className={className} />
  if (kind === 'collection') return <TableGlyph icon={icon} className={className} />
  return <CircleStackIcon aria-hidden className={className} />
}
