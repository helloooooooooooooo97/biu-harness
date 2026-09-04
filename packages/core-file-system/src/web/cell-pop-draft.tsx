import { useRef, useState } from 'react'
import type { DbRecord, FieldSpec } from '@biu/type-file-system'
import { FieldEditor, fieldDraftValue, parseFieldValue } from './fsdb-cells.tsx'
import { SchemaFieldEditor } from './schema-field.tsx'
import { parseFacetFlatColumnKey, resolveFieldType } from './fields.ts'

export function CellPopDraft({
  record,
  fieldKey,
  field,
  initial,
  options,
  collectionPath,
  onClose,
  onSubmit,
}: {
  record: DbRecord
  fieldKey: string
  field: FieldSpec
  initial: unknown
  options: string[]
  collectionPath: string
  onClose: () => void
  onSubmit: (raw: unknown) => void
}) {
  const kind = resolveFieldType(field)
  const flat = parseFacetFlatColumnKey(fieldKey)
  const [text, setText] = useState(() => fieldDraftValue(field, initial))
  const [raw, setRaw] = useState<unknown>(initial)
  const rawRef = useRef(initial)
  function put(next: unknown, nextText?: string) {
    rawRef.current = next
    setRaw(next)
    if (nextText != null) setText(nextText)
  }
  return (
    <>
      {kind === 'facet' ? (
        <SchemaFieldEditor collectionPath={collectionPath} record={record} value={raw} writable autoOpen onChange={(next) => put(next)} />
      ) : (
        <FieldEditor
          fieldKey={flat ? field.label ?? flat.fieldKey : fieldKey}
          field={field}
          value={text}
          source={raw}
          collectionPath={collectionPath}
          autoOpen
          options={options}
          onChange={(next) => {
            setText(next)
            put(parseFieldValue(field, next))
          }}
          onCommit={(next) => {
            put(next, fieldDraftValue(field, next))
          }}
        />
      )}
      <div className="fsdb-cell-pop-actions">
        <button type="button" className="fsdb-dlg-cancel" onClick={onClose}>
          取消
        </button>
        <button type="button" className="fsdb-dlg-ok" onClick={() => onSubmit(rawRef.current)}>
          提交
        </button>
      </div>
    </>
  )
}
