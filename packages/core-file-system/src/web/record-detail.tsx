import { useState, type ReactNode, type Dispatch, type SetStateAction } from 'react'
import type { CollectionChrome } from '@biu/type-file-system/ui'
import type { CollectionSchema, DbRecord, FieldSpec } from '@biu/type-file-system'
import { HashtagIcon } from '@heroicons/react/16/solid'
import { TrashGlyph } from '@biu/web-session-view/trash-glyph'
import { contentFieldKey, formatField, resolveFieldType, uniqueValues } from './fields.ts'
import { LocalText } from './controls.tsx'
import { FieldEditor, FieldGlyph, FilePreview } from './fsdb-cells.tsx'
import { SchemaFieldEditor } from './schema-field.tsx'
import { RecordEmojiBoard } from '@biu/public-ui'
import { TableGlyph } from './nav-glyphs.tsx'
import { normalizeRecordEmoji, recordPreviewEmoji } from './sidebar-preview.ts'

function DetailTitleIcon({
  emoji,
  tableIcon,
  label,
  record,
  Icon,
  onChange,
}: {
  emoji: string
  tableIcon?: string
  label: string
  record: DbRecord
  Icon?: CollectionChrome['Icon']
  onChange: (next: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(emoji)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  return (
    <span className="fsdb-detail-title-icon-wrap">
      <button
        type="button"
        className="fsdb-detail-title-icon"
        title={emoji ? '更换图标' : '设置图标'}
        aria-label={emoji ? `更换 ${label} 的图标` : `设置 ${label} 的图标`}
        onClick={(event) => {
          const btn = event.currentTarget
          setOpen((prev) => {
            if (prev) {
              setAnchor(null)
              return false
            }
            setDraft(emoji)
            setAnchor(btn)
            return true
          })
        }}
      >
        {emoji ? (
          <span className="fsdb-record-emoji">{emoji}</span>
        ) : Icon ? (
          <Icon record={record} />
        ) : (
          <TableGlyph icon={tableIcon} className="size-8" />
        )}
      </button>
      {open && anchor ? (
        <RecordEmojiBoard
          anchor={anchor}
          draft={draft}
          onDraft={setDraft}
          onPick={(next) => {
            onChange(normalizeRecordEmoji(next))
            setOpen(false)
            setAnchor(null)
          }}
          onClear={() => {
            onChange('')
            setOpen(false)
            setAnchor(null)
          }}
          onClose={() => {
            setOpen(false)
            setAnchor(null)
          }}
        />
      ) : null}
    </span>
  )
}

export function RecordDetail({
  selected,
  schema,
  chrome,
  draft,
  items,
  detailBody,
  labelOf,
  renderCell,
  setDraft,
  writeOne,
  writePatch,
  tableIcon,
  collectionPath,
  onDelete,
}: {
  selected: DbRecord
  schema: CollectionSchema
  chrome?: CollectionChrome
  draft: Record<string, string>
  items: DbRecord[]
  detailBody: unknown
  labelOf: (row: DbRecord) => string
  renderCell: (row: DbRecord, key: string, field: FieldSpec) => ReactNode
  setDraft: Dispatch<SetStateAction<Record<string, string>>>
  writeOne: (row: DbRecord, key: string, field: FieldSpec, raw: string) => Promise<unknown> | void
  writePatch: (row: DbRecord, patch: Record<string, unknown>) => Promise<unknown> | void
  tableIcon?: string
  collectionPath: string
  onDelete?: () => void
}) {
  return (
<div className="fsdb-detail-stage">
          <div className="fsdb-detail-screen" role="main" aria-label="记录详情">
            <div className="fsdb-detail-split">
              <div className="fsdb-detail-main">
                <div className="fsdb-detail-title-row">
                <DetailTitleIcon
                  emoji={recordPreviewEmoji(selected)}
                  tableIcon={tableIcon}
                  label={labelOf(selected)}
                  record={selected}
                  Icon={chrome?.Icon}
                  onChange={(next) => {
                    void Promise.resolve(writePatch(selected, { emoji: next })).then(() => {
                      window.dispatchEvent(new Event('fsdb:change'))
                    })
                  }}
                />
                {schema.labelField && schema.fields[schema.labelField]?.writable ? (
                  <h1 className="fsdb-detail-title">
                    <LocalText
                      as="textarea"
                      className="fsdb-detail-title-input"
                      value={draft[schema.labelField] ?? ''}
                      rows={(draft[schema.labelField] ?? '').length > 48 ? 2 : 1}
                      onCommit={(raw) => {
                        const next = raw.trim()
                        setDraft((prev) => ({ ...prev, [schema.labelField!]: next }))
                        if (next && next !== String(selected[schema.labelField!] ?? '')) {
                          void writeOne(selected, schema.labelField!, schema.fields[schema.labelField!]!, next)
                        }
                      }}
                    />
                  </h1>
                ) : (
                  <h1 className="fsdb-detail-title">{labelOf(selected)}</h1>
                )}
                {onDelete ? (
                  <button type="button" className="tasks-icon-btn is-danger" title="删除" aria-label="删除记录" onClick={onDelete}>
                    <TrashGlyph aria-hidden className="size-[14px]" />
                  </button>
                ) : null}
                </div>
                <div className="fsdb-detail-aside">
                  <div className="fsdb-prop">
                    <span>
                      <HashtagIcon aria-hidden className="size-[14px]" />
                      ID
                    </span>
                    <span className="fsdb-detail-id" title={selected.id}>
                      {selected.id}
                    </span>
                  </div>
                  {Object.entries(schema.fields).map(([key, field]) => {
                    if (key === 'id' || key === schema.labelField || key === contentFieldKey(schema)) return null
                    if (collectionPath === '/supertags' && key === 'schema') return null
                    const kind = resolveFieldType(field)
                    if (kind === 'schema') {
                      return (
                        <div key={key} className="fsdb-prop is-stack">
                          <span title={field.label ?? key}>
                            <FieldGlyph kind={kind} />
                            {field.label ?? key}
                          </span>
                          <div className="fsdb-prop-val is-schema">
                            <SchemaFieldEditor
                              collectionPath={collectionPath}
                              record={selected}
                              value={selected[key]}
                              writable={field.writable}
                              onChange={(next) => void writePatch(selected, { [key]: next })}
                            />
                          </div>
                        </div>
                      )
                    }
                    return (
                      <div key={key} className="fsdb-prop">
                        <span title={field.label ?? key}>
                          <FieldGlyph kind={kind} />
                          {field.label ?? key}
                        </span>
                        <div className="fsdb-prop-val" title={formatField(field, selected[key])}>
                        {field.writable ? (
                          <FieldEditor
                            fieldKey={key}
                            field={field}
                            value={draft[key] ?? ''}
                            options={uniqueValues(items, key, field)}
                            onChange={(next) => {
                              setDraft((prev) => ({ ...prev, [key]: next }))
                              void writeOne(selected, key, field, next)
                            }}
                          />
                        ) : (
                          renderCell(selected, key, field)
                        )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {contentFieldKey(schema) && schema.fields[contentFieldKey(schema)!] ? (() => {
                  const key = contentFieldKey(schema)!
                  const spec = schema.fields[key]!
                  const ContentView = chrome?.Content
                  if (ContentView) {
                    return (
                      <div className="fsdb-fileview">
                        <ContentView
                          record={selected}
                          field={key}
                          spec={spec}
                          value={detailBody}
                          writable={spec.writable}
                          onChange={(next) => void writePatch(selected, { [key]: next })}
                        />
                      </div>
                    )
                  }
                  if (spec.writable) {
                    const saved =
                      typeof detailBody === 'string' || detailBody == null
                        ? String(detailBody ?? '')
                        : JSON.stringify(detailBody, null, 2)
                    return (
                      <LocalText
                        as="textarea"
                        className="fsdb-detail-doc"
                        value={draft[key] ?? saved}
                        rows={12}
                        placeholder="内容：文本，或 JSON 文件"
                        onCommit={(next) => {
                          setDraft((prev) => ({ ...prev, [key]: next }))
                          if (next !== saved) void writeOne(selected, key, spec, next)
                        }}
                      />
                    )
                  }
                  return (
                    <div className="fsdb-fileview">
                      <FilePreview value={detailBody} />
                    </div>
                  )
                })() : null}
                {chrome?.panes?.length ? (
                  <div className="fsdb-detail-extras">
                    {chrome.panes.map((pane) => {
                      const Pane = pane.Pane
                      const count = pane.badge?.(selected)
                      return (
                        <section key={pane.id} className="fsdb-detail-extra" data-testid={`fsdb-pane-${pane.id}`}>
                          <h3 className="fsdb-detail-extra-title">
                            {pane.label}
                            {count ? <span className="fsdb-detail-extra-count">{count}</span> : null}
                          </h3>
                          <Pane record={selected} />
                        </section>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
  )
}
