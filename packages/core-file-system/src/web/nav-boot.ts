import type { CollectionInfo } from '@biu/type-file-system'

export function collectionNavKey(rows: CollectionInfo[]) {
  return rows
    .filter((row) => row.view?.moduleId && row.view.route)
    .map((row) => row.view!.moduleId)
    .sort()
    .join(',')
}

/** Host 插件登记表会晚于 UI apply；失败或空列表时短轮询，避免导航一直空白。 */
export async function bootLoadCollections(
  load: () => Promise<CollectionInfo[]>,
  opts?: {
    attempts?: number
    delayMs?: number
    stopped?: () => boolean
    wait?: (ms: number) => Promise<void>
    onUpdate?: (rows: CollectionInfo[]) => void
  },
): Promise<CollectionInfo[]> {
  const attempts = opts?.attempts ?? 30
  const delayMs = opts?.delayMs ?? 100
  const wait = opts?.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  let last: CollectionInfo[] = []
  let stable = 0
  let prev = ''
  for (let i = 0; i < attempts; i++) {
    if (opts?.stopped?.()) return last
    try {
      last = await load()
      opts?.onUpdate?.(last)
    } catch {
      last = last.length ? last : []
    }
    const key = collectionNavKey(last)
    if (key && key === prev) {
      stable += 1
      if (stable >= 2) return last
    } else {
      stable = 0
      prev = key
    }
    if (i + 1 < attempts) await wait(delayMs)
  }
  return last
}
