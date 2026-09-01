import type { CollectionChrome } from '@biu/type-file-system/ui'
import { SuperTagPackEditor } from './schema-field.tsx'
import { loadSchemaTags } from './schema-tags.ts'

function SuperTagFieldsPane({ record }: { record: { id: string } }) {
  const tag = loadSchemaTags().find((item) => item.id === record.id)
  if (!tag) return null
  return <SuperTagPackEditor tagId={record.id} />
}

export const superTagsChrome: CollectionChrome = {
  panes: [{ id: 'fields', label: '字段', Pane: SuperTagFieldsPane }],
}
