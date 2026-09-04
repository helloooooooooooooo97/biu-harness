import type { ReactNode } from 'react'
import { AnchorMenu } from '@biu/public-ui'
import type { FieldType } from '@biu/type-file-system'

export function cellUsesPop(kind: FieldType, writable?: boolean) {
  if (!writable) return false
  return kind !== 'boolean' && kind !== 'action' && kind !== 'file'
}

export function CellPop({
  open,
  anchor,
  onClose,
  children,
}: {
  open: boolean
  anchor: HTMLElement | null
  onClose: () => void
  children: ReactNode
}) {
  if (!open || !anchor) return null
  return (
    <AnchorMenu
      anchor={anchor}
      onClose={onClose}
      className="fsdb-cell-pop"
      role="dialog"
      minWidth={280}
      zIndex={220}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {children}
    </AnchorMenu>
  )
}
