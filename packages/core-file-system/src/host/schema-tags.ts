import { normalizeSchemaPack, type CollectionSchemaPack } from '@biu/type-file-system'

/** 工作区一份 SuperTag 目录，不按表拆。 */
export class SchemaTagsStore {
  private tags: CollectionSchemaPack[] = []

  list(): CollectionSchemaPack[] {
    return this.tags
  }

  replace(tags: unknown[]): CollectionSchemaPack[] {
    const seen = new Set<string>()
    const next: CollectionSchemaPack[] = []
    for (const item of tags) {
      const pack = normalizeSchemaPack(item)
      if (!pack || seen.has(pack.id)) continue
      seen.add(pack.id)
      next.push(pack)
    }
    this.tags = next
    return this.tags
  }
}
