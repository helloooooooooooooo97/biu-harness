import { type ReactNode } from 'react'
import type { FieldSpec } from '@biu/type-file-system'
import { resolveFieldType } from './fields.ts'
import { FieldGlyph } from './fsdb-cells.tsx'

export function PropertyRow({
  field,
  fieldKey,
  stacked,
  children,
}: {
  field: FieldSpec
  fieldKey?: string
  stacked?: boolean
  children: ReactNode
}) {
  const kind = resolveFieldType(field)
  const label = field.label ?? fieldKey ?? ''
  return (
    <div className={`fsdb-proprow${stacked ? ' is-stack' : ''}`}>
      <span className="fsdb-proprow-k" title={label}>
        <FieldGlyph kind={kind} />
        <span className="fsdb-proprow-label">{label}</span>
      </span>
      <span className="fsdb-proprow-v">{children}</span>
    </div>
  )
}
