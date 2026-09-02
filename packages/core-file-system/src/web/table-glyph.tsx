import {
  ClipboardDocumentListIcon,
  ChatBubbleLeftRightIcon,
  BoltIcon,
  DocumentIcon,
  EyeIcon,
  TagIcon,
  PuzzlePieceIcon,
  TableCellsIcon,
} from '@heroicons/react/16/solid'

export function TableGlyph({ icon, className = 'size-4' }: { icon?: string; className?: string }) {
  const name = (icon ?? '').trim().toLowerCase()
  if (name === 'puzzle-piece' || name === 'puzzle') return <PuzzlePieceIcon aria-hidden className={className} />
  if (name === 'clipboard-document-list' || name === 'clipboard') return <ClipboardDocumentListIcon aria-hidden className={className} />
  if (name === 'chat-bubble' || name === 'chat-bubble-left-right') return <ChatBubbleLeftRightIcon aria-hidden className={className} />
  if (name === 'document' || name === 'document-text' || name === 'page') return <DocumentIcon aria-hidden className={className} />
  if (name === 'bolt') return <BoltIcon aria-hidden className={className} />
  if (name === 'eye') return <EyeIcon aria-hidden className={className} />
  if (name === 'tag') return <TagIcon aria-hidden className={className} />
  return <TableCellsIcon aria-hidden className={className} />
}
