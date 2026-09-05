import { useEffect, useMemo, useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/16/solid'
import { TagChip, TagChips } from '@biu/public-ui'
import { DbSearchOption, ensureDbSearchStyle } from '@biu/database-ui'
import type { DbRecord } from '@biu/type-file-system'
import { listCollection } from './db-client.ts'
import { crumbRecordLabel } from './sidebar-preview.ts'
import { isParentLinkField, recordLinkIds } from './fields.ts'

export type RecordLinkPeer = { id: string; label: string }

function labelOf(row: DbRecord, labelField?: string) {
  return crumbRecordLabel(row, labelField)
}

function asPeers(rows: DbRecord[], labelField?: string): RecordLinkPeer[] {
  return rows.map((row) => ({ id: row.id, label: labelOf(row, labelField) }))
}

const TABLE_PAGE = 200
const TABLE_CAP = 500

async function loadTablePeers(path: string, labelField?: string): Promise<RecordLinkPeer[]> {
  const first = await listCollection({ path, limit: TABLE_PAGE, offset: 0, sortField: 'id' })
  const rows = [...first.items]
  while (rows.length < first.total && rows.length < TABLE_CAP) {
    const more = await listCollection({ path, limit: TABLE_PAGE, offset: rows.length, sortField: 'id' })
    if (!more.items.length) break
    rows.push(...more.items)
  }
  return asPeers(rows, labelField ?? first.schema?.labelField)
}

export function RecordLinkChips({
  fieldKey,
  value,
  peers,
}: {
  fieldKey: string
  value: unknown
  peers?: RecordLinkPeer[]
}) {
  const ids = recordLinkIds(fieldKey, value)
  if (!ids.length) return null
  const byId = new Map((peers ?? []).map((item) => [item.id, item.label]))
  return (
    <TagChips>
      {ids.map((id) => (
        <TagChip key={id} id={id} label={byId.get(id) ?? id} />
      ))}
    </TagChips>
  )
}

export function RecordPickPanel({
  fieldKey,
  value,
  collectionPath,
  excludeId,
  labelField,
  seed,
  onChange,
  onPicked,
}: {
  fieldKey: string
  value: unknown
  collectionPath: string
  excludeId?: string
  labelField?: string
  seed?: DbRecord[]
  onChange: (next: unknown) => void
  onPicked?: () => void
}) {
  ensureDbSearchStyle()
  const multiple = !isParentLinkField(fieldKey)
  const selected = recordLinkIds(fieldKey, value)
  const [query, setQuery] = useState('')
  const [peers, setPeers] = useState<RecordLinkPeer[]>(() => asPeers(seed ?? [], labelField))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void loadTablePeers(collectionPath, labelField)
      .then((rows) => {
        if (!cancelled) setPeers(rows)
      })
      .catch(() => {
        if (!cancelled) setPeers(asPeers(seed ?? [], labelField))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [collectionPath, labelField])

  const byId = useMemo(() => new Map(peers.map((item) => [item.id, item.label])), [peers])
  const q = query.trim().toLowerCase()
  const available = peers.filter(
    (item) =>
      item.id !== excludeId &&
      (multiple ? !selected.includes(item.id) : true) &&
      (!q || item.label.toLowerCase().includes(q) || item.id.toLowerCase().includes(q)),
  )

  function commit(nextIds: string[]) {
    if (multiple) onChange(nextIds)
    else onChange(nextIds[0] ?? '')
  }

  function pick(id: string) {
    if (!id || id === excludeId) return
    if (multiple) {
      if (!selected.includes(id)) commit([...selected, id])
    } else {
      commit(id === selected[0] ? [] : [id])
      onPicked?.()
    }
    setQuery('')
  }

  return (
    <div className="fsdb-cell-pop-tags">
      {selected.length ? (
        <div className="fsdb-cell-pop-picked">
          <TagChips>
            {selected.map((id) => (
              <TagChip
                key={id}
                id={id}
                label={byId.get(id) ?? id}
                onRemove={() => commit(selected.filter((item) => item !== id))}
              />
            ))}
          </TagChips>
        </div>
      ) : null}
      <label className="db-search-field">
        <input
          value={query}
          autoFocus
          placeholder="搜索本表记录"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              if (available[0]) pick(available[0].id)
            }
          }}
        />
      </label>
      <div className="db-search-list">
        {available.map((item) => (
          <DbSearchOption key={item.id} selected={!multiple && selected[0] === item.id} onClick={() => pick(item.id)}>
            <TagChip id={item.id} label={item.label} />
          </DbSearchOption>
        ))}
        {loading ? (
          <div className="fsdb-person-loading">
            <ArrowPathIcon className="size-[14px] fsdb-spin" aria-hidden />
            加载本表…
          </div>
        ) : null}
        {!loading && !available.length ? <div className="fsdb-person-loading">本表没有可选项</div> : null}
      </div>
    </div>
  )
}
