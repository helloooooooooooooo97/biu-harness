import { useRef, type ReactNode } from 'react'
import { AnchorMenu } from '@biu/public-ui'
import type { FieldType } from '@biu/type-file-system'

export function cellUsesPop(kind: FieldType, writable?: boolean) {
  if (!writable) return false
  return kind === 'facet'
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
  const openedAt = useRef(performance.now())
  if (!open || !anchor) return null
  return (
    <AnchorMenu
      anchor={anchor}
      onClose={() => {
        if (performance.now() - openedAt.current < 400) return
        onClose()
      }}
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
