import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Service, type Context } from 'cordis'
import '../../types.ts'
import { SESSION_FORMAT_VERSION, type SessionRecord, type SessionStore } from '../core/session-types.ts'

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

  delete(id: string) {
    return this.inner.delete(id)
  }
}

export const name = 'session-store'
export const inject = [] as const

export function apply(ctx: Context, config: { driver?: 'memory' | 'json'; dir?: string } = {}) {
  const driver = config.driver ?? (process.env.CORDIS_SESSION_STORE === 'memory' ? 'memory' : 'json')
  const inner =
    driver === 'memory'
      ? new MemorySessionStore()
      : new JsonSessionStore(config.dir ?? join(process.cwd(), '.cordis', 'sessions'))
  new SessionStoreService(ctx, inner)
}
