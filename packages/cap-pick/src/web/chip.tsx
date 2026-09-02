import {
  CpuChipIcon,
  CircleStackIcon,
  StopCircleIcon,
  HashtagIcon,
  Square3Stack3DIcon,
  RectangleStackIcon,
  DocumentIcon,
  ClipboardDocumentCheckIcon,
  ChatBubbleLeftIcon,
  PuzzlePieceIcon,
  TagIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/16/solid'
import type { ComponentType } from 'react'
import { ensureTagChipStyle, TagChipCloseMark, tagTone } from '@biu/public-ui'
import type { PickRef } from './types.ts'
import { chipLabel } from './types.ts'

/** 采集点 kind 字符串映射到 SuperTag 色板。 */
export function pickKindTone(kind: string) {
  return tagTone(kind)
}

type Glyph = ComponentType<{ className?: string }>

const KIND_ICONS: Record<string, Glyph> = {
  session: CpuChipIcon,
  task: ClipboardDocumentCheckIcon,
  page: DocumentIcon,
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

export function PickChip({ pick, onRemove }: { pick: PickRef; onRemove?: () => void }) {
  ensureTagChipStyle()
  const label = chipLabel(pick)
  return (
    <span
      className="biu-tag composer-tool-chip is-pick"
      data-testid="user-pick-chip"
      data-pick-kind={pick.kind}
      title={`${pick.kind} · ${label}`}
      style={{ ['--biu-tag' as string]: pickKindTone(pick.kind) }}
    >
      <PickChipLabel pick={pick} />
      {onRemove ? (
        <button
          type="button"
          className="biu-tag-x"
          aria-label={`移除 ${label}`}
          contentEditable={false}
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onRemove()
          }}
        >
          <TagChipCloseMark />
        </button>
      ) : null}
    </span>
  )
}
