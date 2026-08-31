import { Service, type Context } from 'cordis'

export type DockGroup = 'places' | 'tools' | 'tray'

export type DockKind = 'session' | 'tool' | 'composer' | 'plugin' | 'module'

const GROUP_RANK: Record<DockGroup, number> = {
  places: 0,
  tools: 1,
  tray: 2,
}

function defaultGroup(kind: DockKind, pinned: boolean): DockGroup {
  if (!pinned || kind === 'plugin') return 'tray'
  if (kind === 'session' || kind === 'module') return 'places'
  if (kind === 'composer') return 'tools'
  return 'tools'
}

export type DockApp = {
  id: string
  title: string
  order: number
  group: DockGroup
  kind: DockKind
  pinned: boolean
  running: boolean
  focused: boolean
  minimized: boolean
  Tile?: () => unknown
  Icon?: () => unknown
  onOpen?: () => void
  onClose?: () => void
}

export type DockAppInput = {
  id: string
  title: string
  order?: number
  group?: DockGroup
  kind?: DockKind
  pinned?: boolean
  Tile?: () => unknown
  Icon?: () => unknown
  onOpen?: () => void
  onClose?: () => void
}

export type DockSnapshot = {
  apps: DockApp[]
}

type Listener = () => void

const DEFAULT_ORDER: Record<string, number> = {
  session: 10,
  composer: 30,
  pick: 31,
  settings: 200,
  update: 201,
}

export class DockService extends Service {
  private readonly apps = new Map<string, DockApp>()
  private readonly listeners = new Set<Listener>()
  private focusedId: string | null = null

  private cached: DockApp[] = []

  constructor(ctx: Context) {
    super(ctx, 'dock')
  }

  register(input: DockAppInput): () => void {
    const existing = this.apps.get(input.id)
    const next: DockApp = {
      id: input.id,
      title: input.title,
      order: input.order ?? existing?.order ?? DEFAULT_ORDER[input.id] ?? (input.kind === 'plugin' || existing?.kind === 'plugin' ? 300 : 100),
      kind: input.kind ?? existing?.kind ?? 'tool',
      pinned: input.pinned ?? existing?.pinned ?? true,
      group: input.group ?? existing?.group ?? defaultGroup(input.kind ?? existing?.kind ?? 'tool', input.pinned ?? existing?.pinned ?? true),
      running: existing?.running ?? false,
      focused: existing?.focused ?? false,
      minimized: existing?.minimized ?? false,
      Tile: input.Tile ?? existing?.Tile,
      Icon: input.Icon ?? existing?.Icon,
      onOpen: input.onOpen ?? existing?.onOpen,
      onClose: input.onClose ?? existing?.onClose,
    }
    this.apps.set(input.id, next)
    this.emit()
    return () => this.unregister(input.id)
  }

  patch(id: string, patch: Partial<Omit<DockApp, 'id'>>): void {
    const current = this.apps.get(id)
    if (!current) return
    this.apps.set(id, { ...current, ...patch, id })
    this.emit()
  }

  unregister(id: string): void {
    if (!this.apps.delete(id)) return
    if (this.focusedId === id) this.focusedId = null
    this.emit()
  }

  open(id: string): void {
    const app = this.apps.get(id)
    if (!app) return
    this.apps.set(id, { ...app, running: true, minimized: false, focused: true })
    this.focusedId = id
    for (const [otherId, other] of this.apps) {
      if (otherId === id) continue
      this.apps.set(otherId, { ...other, focused: false })
    }
    app.onOpen?.()
    this.emit()
  }

  minimize(id: string): void {
    const app = this.apps.get(id)
    if (!app) return
    this.apps.set(id, { ...app, minimized: true, focused: false })
    if (this.focusedId === id) this.focusedId = null
    this.emit()
  }

  close(id: string): void {
    const app = this.apps.get(id)
    if (!app) return
    app.onClose?.()
    if (app.pinned) {
      this.apps.set(id, { ...app, running: false, minimized: false, focused: false })
    } else {
      this.apps.delete(id)
    }
    if (this.focusedId === id) this.focusedId = null
    this.emit()
  }

  focus(id: string): void {
    if (!this.apps.has(id)) return
    this.focusedId = id
    for (const [otherId, other] of this.apps) {
      this.apps.set(otherId, { ...other, focused: otherId === id, running: otherId === id ? true : other.running })
    }
    this.emit()
  }

  list(): DockApp[] {
    return this.cached
  }

  snapshot(): DockSnapshot {
    return { apps: this.list() }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private rebuild(): DockApp[] {
    return [...this.apps.values()].sort((a, b) => {
      if (a.group !== b.group) return GROUP_RANK[a.group] - GROUP_RANK[b.group]
      return a.order - b.order || a.id.localeCompare(b.id)
    })
  }

  private emit(): void {
    this.cached = this.rebuild()
    for (const listener of this.listeners) listener()
  }
}
