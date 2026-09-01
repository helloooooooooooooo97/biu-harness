import { CollectionBrowser } from './browser.tsx'
import { stampRowOpenTarget } from '../catalog-views.ts'
import { SUPERTAGS_COLLECTION_PATH } from './database-path.ts'

export function SuperTagCollectBoard({
  record,
  openRecord,
}: {
  record: { id: string; title?: unknown }
  openRecord?: (recordId: string, collection?: string) => void
}) {
  const tagId = String(record.id ?? '').trim()
  if (!tagId || tagId.includes('::')) return null
  return (
    <div className="fsdb-tag-collect" data-testid="fsdb-tag-collect">
      <CollectionBrowser
        embed
        sheet
        collectionPath={SUPERTAGS_COLLECTION_PATH}
        title={String(record.title ?? tagId)}
        blurb=""
        lockedFilters={{ tag: tagId }}
        onOpenRow={(row) => {
          const stamp = stampRowOpenTarget({ tablePath: row.tablePath, sourceId: row.sourceId })
          if (stamp) openRecord?.(stamp.recordId, stamp.collection)
          return true
        }}
      />
    </div>
  )
}
