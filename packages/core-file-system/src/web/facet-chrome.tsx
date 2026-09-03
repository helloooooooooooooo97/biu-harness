import type { CollectionChrome } from '@biu/type-file-system/ui'
import { FacetPackEditor } from './schema-field.tsx'
import { FacetCollectBoard } from './facet-collect.tsx'
import { loadFacets } from './facet-catalog.ts'

function FacetFieldsPane({ record }: { record: { id: string } }) {
  const facet = loadFacets().find((item) => item.id === record.id)
  if (!facet) return null
  return <FacetPackEditor facetId={record.id} />
}

export const facetsChrome: CollectionChrome = {
  Board: FacetCollectBoard,
  panes: [{ id: 'fields', label: '字段', Pane: FacetFieldsPane }],
}
