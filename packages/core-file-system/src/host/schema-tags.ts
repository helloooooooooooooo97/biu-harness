import { normalizeCollectionPath } from '../paths.ts'
import { normalizeSchemaPack, type CollectionSchemaPack } from '@biu/type-file-system'

export class SchemaTagsStore {
  private byPath = new Map<string, CollectionSchemaPack[]>()

  list(collectionPath: string): CollectionSchemaPack[] {
    return this.byPath.get(normalizeCollectionPath(collectionPath)) ?? []
  }

  replace(collectionPath: string, tags: unknown[]) {
    const path = normalizeCollectionPath(collectionPath)
    const next = tags.map((item) => normalizeSchemaPack(item)).filter((item): item is CollectionSchemaPack => Boolean(item))
    this.byPath.set(path, next)
  }
}
