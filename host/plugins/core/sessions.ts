import { Service, type Context } from 'cordis'
import '../../types.ts'
import type { LlmMessage } from '../orchestration/llm.ts'
import { SESSION_FORMAT_VERSION, type SessionEvent, type SessionRecord } from './session-types.ts'

export type { SessionEvent, SessionRecord }
export { SESSION_FORMAT_VERSION }

export function deriveMessages(events: SessionEvent[]): LlmMessage[] {
  let system = ''
  const messages: LlmMessage[] = []
  for (const event of events) {
    if (event.type === 'system/prompt') {
      system = event.text
    } else if (event.type === 'user/message') {
      messages.push({ role: 'user', content: event.text })
    } else if (event.type === 'assistant/message') {
      messages.push({
        role: 'assistant',
        content: event.text,
        tool_calls: event.tool_calls?.map((call) => ({
          id: call.id,
          type: 'function',
          function: { name: call.name, arguments: call.arguments },
        })),
      })
    } else if (event.type === 'tool/result') {
      messages.push({ role: 'tool', tool_call_id: event.id, content: event.detail })
    }
  }
  return system ? [{ role: 'system', content: system }, ...messages] : messages
}

export class SessionsService extends Service {
  private cache = new Map<string, SessionRecord>()

  constructor(ctx: Context) {
    super(ctx, 'sessions')
  }

  async create(id = crypto.randomUUID()) {
    const record: SessionRecord = {
      id,
      version: SESSION_FORMAT_VERSION,
      events: [{ type: 'session/open', version: SESSION_FORMAT_VERSION, seq: 0, ts: Date.now() }],
    }
    await this.persist(record)
    return record
  }

  async get(id: string) {
    const hit = this.cache.get(id)
    if (hit) return hit
    const loaded = await this.ctx.sessionStore.load(id)
    if (loaded) this.cache.set(id, loaded)
    return loaded
  }

  async require(id: string) {
    const record = await this.get(id)
    if (!record) throw new Error(`unknown session: ${id}`)
    return record
  }

  async append(id: string, body: Omit<SessionEvent, 'seq' | 'ts'>) {
    const record = await this.require(id)
    const event = { ...body, seq: record.events.length, ts: Date.now() } as SessionEvent
    record.events.push(event)
    await this.persist(record)
    this.ctx.emit('session/event', { sessionId: id, event })
    this.ctx.http?.broadcast('session', { sessionId: id, event })
    return event
  }

  deriveMessages(id: string) {
    const record = this.cache.get(id)
    if (!record) throw new Error(`unknown session: ${id}`)
    return deriveMessages(record.events)
  }

  async fork(sourceId: string, childId = crypto.randomUUID()) {
    const source = await this.require(sourceId)
    const record: SessionRecord = {
      id: childId,
      version: source.version,
      events: source.events.map((event) => ({ ...event })),
    }
    await this.persist(record)
    return record
  }

  list() {
    return this.ctx.sessionStore.list()
  }

  private async persist(record: SessionRecord) {
    this.cache.set(record.id, record)
    await this.ctx.sessionStore.save(record)
  }
}

export const name = 'sessions'
export const inject = ['sessionStore']

export function apply(ctx: Context) {
  new SessionsService(ctx)
}
