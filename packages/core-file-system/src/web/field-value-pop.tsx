import { useRef, useState } from 'react'
import type { DbRecord, FieldSpec } from '@biu/type-file-system'
import { CellPop, cellUsesPop } from './cell-pop.tsx'
import { CellPopDraft } from './cell-pop-draft.tsx'
import { ActionCell, BoolCell, DefaultCell } from './fsdb-cells.tsx'
import { isRecordLinkField, resolveFieldType } from './fields.ts'

const POP_HOST_IGNORE = '.fsdb-ref-chip, .fsdb-boolbtn, .fsdb-thumb-btn, .fsdb-thumb, .ant-image, .fsdb-file-tools, .fsdb-action-btn'

export function FieldValuePop({
  record,
  fieldKey,
  field,
  value,
  collectionPath,
  options = [],
  records,
  onSubmit,
}: {
  record: DbRecord
  fieldKey: string
  field: FieldSpec
  value: unknown
  collectionPath: string
  options?: string[]
  records?: DbRecord[]
  onSubmit: (raw: unknown) => void
}) {
  const hostRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const kind = resolveFieldType(field)
  if (kind === 'action') {
    return <ActionCell field={field} fieldKey={fieldKey} />
  }
  if (kind === 'boolean') {
    const on = value === true || value === 'true'
    if (!field.writable) return <BoolCell on={on} />
    return <BoolCell on={on} writable onToggle={() => onSubmit(!on)} />
  }
  const display = (
    <DefaultCell
      field={field}
      fieldKey={fieldKey}
      records={records}
      collectionPath={collectionPath}
      value={value}
      onChange={field.writable && kind === 'attachment' ? onSubmit : undefined}
    />
  )
  if (!cellUsesPop(kind, field.writable)) return display
  return (
    <>
      <span
        ref={hostRef}
        className="fsdb-pop-host"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest(POP_HOST_IGNORE)) return
          setOpen(true)
        }}
      >
        {display}
      </span>
      <CellPop
        open={open}
        anchor={hostRef.current}
        className={`is-${kind}${isRecordLinkField(field, fieldKey) ? ' is-record-link' : ''}`}
        onClose={() => setOpen(false)}
      >
        <CellPopDraft
          record={record}
          fieldKey={fieldKey}
          field={field}
          initial={value}
          options={options}
          collectionPath={collectionPath}
          onClose={() => setOpen(false)}
          onSubmit={onSubmit}
        />
      </CellPop>
    </>
  )
}
