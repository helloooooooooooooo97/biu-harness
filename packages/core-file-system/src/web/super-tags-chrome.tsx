import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { CollectionChrome } from '@biu/type-file-system/ui'
import { SuperTagPackEditor } from './schema-field.tsx'
import { databaseRecordPath } from './database-path.ts'

type CollectItem = {
  collection: string
  collectionLabel?: string
  id: string
  title: string
}

function SuperTagFieldsPane({ record }: { record: { id: string } }) {
  return <SuperTagPackEditor tagId={record.id} />
}

function SuperTagCollectPane({ record }: { record: { id: string } }) {
  const [items, setItems] = useState<CollectItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetch(`/api/db/schema-tags?collect=${encodeURIComponent(record.id)}`)
      .then((res) => res.json())
      .then((body: { items?: CollectItem[] }) => {
        if (cancelled) return
        setItems(Array.isArray(body.items) ? body.items : [])
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setItems([])
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [record.id])

  if (loading) return <p className="fsdb-muted">正在收集…</p>
  if (!items.length) return <p className="fsdb-muted">还没有记录勾上这枚 SuperTag。</p>
  return (
    <ul className="fsdb-supertag-collect">
      {items.map((item) => (
        <li key={`${item.collection}/${item.id}`}>
          <Link to={databaseRecordPath(item.collection, item.id)} className="fsdb-supertag-collect-link">
            <span className="fsdb-supertag-collect-title">{item.title || item.id}</span>
            <span className="fsdb-muted">{item.collectionLabel ?? item.collection}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export const superTagsChrome: CollectionChrome = {
  panes: [
    { id: 'fields', label: '字段', Pane: SuperTagFieldsPane },
    {
      id: 'collect',
      label: '收集',
      badge: (record) => {
        const n = Number(record.stampCount)
        return Number.isFinite(n) && n > 0 ? n : undefined
      },
      Pane: SuperTagCollectPane,
    },
  ],
}
