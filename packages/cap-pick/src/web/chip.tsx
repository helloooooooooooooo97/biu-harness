import {
  LuBot,
  LuCoins,
  LuGitCommitHorizontal,
  LuHash,
  LuLayers,
  LuListTodo,
  LuMessageSquare,
  LuPuzzle,
  LuTag,
  LuWrench,
} from 'react-icons/lu'
import type { IconType } from 'react-icons'
import type { PickRef } from './types.ts'
import { chipLabel } from './types.ts'

const KIND_ICONS: Record<string, IconType> = {
  session: LuBot,
  task: LuListTodo,
  plugin: LuPuzzle,
  message: LuMessageSquare,
  reply: LuMessageSquare,
  tool: LuWrench,
  step: LuLayers,
  event: LuGitCommitHorizontal,
  turn: LuHash,
  usage: LuCoins,
}

export function pickKindIcon(kind: string): IconType {
  return KIND_ICONS[kind] ?? LuTag
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
