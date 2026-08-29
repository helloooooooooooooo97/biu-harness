import { Service, type Context } from 'cordis'
import type { CollectionChrome, DatabaseUi } from '@biu/type-file-system/ui'

export function normalizeCollectionPath(path: string) {
  const raw = String(path || '/').trim() || '/'
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`
  if (withSlash === '/') return '/'
  return withSlash.replace(/\/+$/, '') || '/'
}

function mergeChrome(layers: CollectionChrome[]): CollectionChrome {
  const cells: CollectionChrome['cells'] = {}
  let Action: CollectionChrome['Action']
  let Title: CollectionChrome['Title']
  let Content: CollectionChrome['Content']
  for (const layer of layers) {
    Object.assign(cells, layer.cells)
    if (layer.Action) Action = layer.Action
    if (layer.Title) Title = layer.Title
    if (layer.Content) Content = layer.Content
  }
  return { cells, Action, Title, Content }
}

export class DatabaseUiService extends Service implements DatabaseUi {
  private layers = new Map<string, CollectionChrome[]>()
  private snapshot = new Map<string, CollectionChrome>()
  private listeners = new Set<() => void>()

  constructor(ctx: Context) {
    super(ctx, 'databaseUi')
  }

  decorate(path: string, chrome: CollectionChrome) {
    const key = normalizeCollectionPath(path)
    const list = this.layers.get(key) ?? []
    list.push(chrome)
    this.layers.set(key, list)
    this.emit()
    return {
      dispose: () => {
        const next = (this.layers.get(key) ?? []).filter((item) => item !== chrome)
        if (next.length) this.layers.set(key, next)
        else this.layers.delete(key)
        this.emit()
      },
    }
  }

  chrome(path: string): CollectionChrome {
    const key = normalizeCollectionPath(path)
    const cached = this.snapshot.get(key)
    if (cached) return cached
    const merged = mergeChrome(this.layers.get(key) ?? [])
    this.snapshot.set(key, merged)
    return merged
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit() {
    this.snapshot.clear()
    for (const fn of this.listeners) fn()
  }
}
