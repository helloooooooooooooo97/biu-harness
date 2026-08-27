import { LuListTodo, LuMessageSquare, LuPuzzle, LuTag } from 'react-icons/lu'
import type { IconType } from 'react-icons'
import type { PickRef } from './types.ts'
import { chipLabel } from './types.ts'

const KIND_ICONS: Record<string, IconType> = {
  session: LuMessageSquare,
  task: LuListTodo,
  plugin: LuPuzzle,
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
