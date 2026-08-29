import {
  CpuChipIcon,
  CircleStackIcon,
  StopCircleIcon,
  HashtagIcon,
  Square3Stack3DIcon,
  TableCellsIcon,
  RectangleStackIcon,
  ClipboardDocumentCheckIcon,
  ChatBubbleLeftIcon,
  PuzzlePieceIcon,
  TagIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/16/solid'
import type { ComponentType } from 'react'
import type { PickRef } from './types.ts'
import { chipLabel } from './types.ts'

type Glyph = ComponentType<{ className?: string }>

const KIND_ICONS: Record<string, Glyph> = {
  session: CpuChipIcon,
  task: ClipboardDocumentCheckIcon,
  page: TableCellsIcon,
  collection: RectangleStackIcon,
  view: Square3Stack3DIcon,
  plugin: PuzzlePieceIcon,
  message: ChatBubbleLeftIcon,
  reply: ChatBubbleLeftIcon,
  tool: WrenchScrewdriverIcon,
  step: Square3Stack3DIcon,
  event: StopCircleIcon,
  turn: HashtagIcon,
  usage: CircleStackIcon,
}

export function pickKindIcon(kind: string): Glyph {
  return KIND_ICONS[kind] ?? TagIcon
}

export function PickKindGlyph({ kind }: { kind: string }) {
  const Icon = pickKindIcon(kind)
  return <Icon className="pick-kind-icon" aria-hidden data-testid="pick-kind-icon" data-pick-kind={kind} />
}

export function PickChipLabel({ pick }: { pick: PickRef }) {
  return (
    <>
      <PickKindGlyph kind={pick.kind} />
      <span>{chipLabel(pick)}</span>
    </>
  )
}
