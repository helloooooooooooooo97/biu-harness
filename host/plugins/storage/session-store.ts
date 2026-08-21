import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Service, type Context } from 'cordis'
import '../../types.ts'
import {
  SESSION_FORMAT_VERSION,
  type SessionEvent,
  type SessionRecord,
  type SessionStore,
  type SessionSummary,
} from '../core/session-types.ts'

function deriveTitle(events: SessionEvent[], fallbackId: string): string {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i]
    if (event?.type === 'user/message' && event.text.trim()) return event.text.slice(0, 48)
  }
  return fallbackId.slice(0, 8)
}

function toSummary(record: SessionRecord): SessionSummary {
  return {
    id: record.id,
    version: record.version,
    eventCount: record.events.length,
    title: deriveTitle(record.events, record.id),
    updatedAt: record.events.at(-1)?.ts ?? 0,
    ...(record.project ? { project: record.project } : {}),
    ...(record.mascot ? { mascot: record.mascot } : {}),
  }
}

export class MemorySessionStore implements SessionStore {
  private records = new Map<string, SessionRecord>()

  async load(id: string) {
    return this.records.get(id)
  }

  async save(record: SessionRecord) {
    this.records.set(record.id, { ...record, events: [...record.events] })
  }

  async list() {
    return [...this.records.keys()]
  }

  async listSummaries() {
    return [...this.records.values()].map(toSummary).sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async delete(id: string) {
    return this.records.delete(id)
  }
}

export class JsonSessionStore implements SessionStore {
  constructor(private dir: string) {}

  private file(id: string) {
    return join(this.dir, `${id}.json`)
  }

  async load(id: string) {
    try {
      const raw = await readFile(this.file(id), 'utf8')
      const record = JSON.parse(raw) as SessionRecord
      if (record.version !== SESSION_FORMAT_VERSION) {
        throw new Error(`unsupported session version ${record.version}`)
      }
      return record
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
      throw error
    }
  }

  async save(record: SessionRecord) {
    await mkdir(this.dir, { recursive: true })
    await writeFile(this.file(record.id), JSON.stringify(record), 'utf8')
  }

  async list() {
    try {
      const names = await readdir(this.dir)
      return names.filter((name) => name.endsWith('.json')).map((name) => name.slice(0, -5))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }
  }

  async listSummaries() {
    const ids = await this.list()
    const items: SessionSummary[] = []
    for (const id of ids) {
      const record = await this.load(id)
      if (record) items.push(toSummary(record))
    }
    return items.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async delete(id: string) {
    try {
      await unlink(this.file(id))
      return true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
      throw error
    }
  }
}

export class SessionStoreService extends Service implements SessionStore {
  constructor(
    ctx: Context,
    private inner: SessionStore,
  ) {
    super(ctx, 'sessionStore')
  }

  load(id: string) {
    return this.inner.load(id)
  }

  save(record: SessionRecord) {
    return this.inner.save(record)
  }

  list() {
    return this.inner.list()
  }

  listSummaries() {
    return this.inner.listSummaries()
  }

  delete(id: string) {
    return this.inner.delete(id)
  }
}

export const name = 'session-store'
export const inject = [] as const

export type SessionStoreDriver = 'memory' | 'json' | 'sqlite'

export async function apply(
  ctx: Context,
  config: { driver?: SessionStoreDriver; dir?: string; path?: string } = {},
) {
  const envDriver = process.env.CORDIS_SESSION_STORE as SessionStoreDriver | undefined
  const driver = config.driver ?? (envDriver === 'memory' || envDriver === 'json' || envDriver === 'sqlite' ? envDriver : 'sqlite')
  const jsonDir = config.dir ?? join(process.cwd(), '.cordis', 'sessions')
  const sqlitePath = config.path ?? join(process.cwd(), '.cordis', 'sessions.sqlite')

  let inner: SessionStore
  if (driver === 'memory') {
    inner = new MemorySessionStore()
  } else if (driver === 'json') {
    inner = new JsonSessionStore(jsonDir)
  } else {
    const { ensureSqliteSessionStore } = await import('./sqlite-session-store.ts')
    inner = await ensureSqliteSessionStore(sqlitePath, jsonDir)
  }
  new SessionStoreService(ctx, inner)
}
