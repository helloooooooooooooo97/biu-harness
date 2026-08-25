import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { Service, type Context } from 'cordis'

const require = createRequire(import.meta.url)

type DatabaseSync = import('node:sqlite').DatabaseSync
type SQLInputValue = import('node:sqlite').SQLInputValue

export type ChannelRole = 'owner' | 'member'

export type ChannelMember = {
  channelId: string
  memberId: string
  name: string
  role: ChannelRole
  /** 游标：该成员已读取到的消息 seq（增量拉取的基准） */
  cursorSeq: number
  joinedAt: number
}

export type ChannelMessage = {
  seq: number
  channelId: string
  sender: string
  kind: string
  payload: unknown
  ts: number
}

export type ChannelInvite = {
  id: string
  channelId: string
  role: ChannelRole
  expiresAt: number | null
  maxUses: number | null
  used: number
  createdAt: number
}

export type Channel = {
  id: string
  name: string
  owner: string
  createdAt: number
}

type HostCtx = Context & {
  http: {
    route: (
      method: string,
      pattern: string,
      handler: (route: {
        params: Record<string, string>
        query: URLSearchParams
        json: <T = unknown>() => Promise<T>
        send: (status: number, body: unknown) => void
      }) => void | Promise<void>,
    ) => unknown
    broadcast: (type: string, payload: unknown) => void
  }
  hub: {
    register: (page: {
      id: string
      title: string
      subtitle: string
      plugin: string
      kind: string
    }) => unknown
  }
}

function now() {
  return Date.now()
}

function genId(prefix: string) {
  return `${prefix}_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * ChannelService —— 群聊核心存储。
 * 模型：单一有序消息流（channel_messages 自增 seq 定序）+ 成员游标（channel_members.cursor_seq）+ 邀请。
 * 这是"单一事实来源"；内网多机通过这套 API 增量拉取，天然最终一致。
 */
export class ChannelService extends Service {
  private db!: DatabaseSync

  constructor(ctx: Context, private dbPath: string) {
    super(ctx, 'channels')
  }

  open() {
    mkdirSync(dirname(this.dbPath), { recursive: true })
    const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite')
    this.db = new DatabaseSync(this.dbPath)
    this.db.exec('PRAGMA journal_mode = WAL')
    this.db.exec('PRAGMA synchronous = NORMAL')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS channels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS channel_members (
        channel_id TEXT NOT NULL REFERENCES channels(id),
        member_id TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL DEFAULT 'member',
        cursor_seq BIGINT NOT NULL DEFAULT 0,
        joined_at INTEGER NOT NULL,
        PRIMARY KEY (channel_id, member_id)
      );
      -- 有序消息流：seq 服务端自增，天然定序
      CREATE TABLE IF NOT EXISTS channel_messages (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id TEXT NOT NULL,
        sender TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'text',
        payload TEXT NOT NULL,
        ts INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS channel_messages_channel_seq ON channel_messages(channel_id, seq);
      CREATE TABLE IF NOT EXISTS channel_invites (
        id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        expires_at INTEGER,
        max_uses INTEGER,
        used INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
    `)
    return this
  }

  // ==================== 频道 ====================

  createChannel(name: string, owner: string): Channel {
    const id = genId('c')
    this.db
      .prepare('INSERT INTO channels (id, name, owner, created_at) VALUES (?, ?, ?, ?)')
      .run(id, name, owner, now())
    this.addMember(id, owner, name || owner, 'owner')
    return this.getChannel(id)!
  }

  listChannels(): Channel[] {
    return this.db
      .prepare('SELECT id, name, owner, created_at FROM channels ORDER BY created_at DESC')
      .all() as Array<Record<string, unknown>> as unknown as Channel[]
  }

  getChannel(id: string): Channel | undefined {
    const row = this.db.prepare('SELECT id, name, owner, created_at FROM channels WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined
    if (!row) return undefined
    return {
      id: row.id as string,
      name: row.name as string,
      owner: row.owner as string,
      createdAt: row.created_at as number,
    }
  }

  // ==================== 成员 ====================

  addMember(channelId: string, memberId: string, name: string, role: ChannelRole): void {
    this.db
      .prepare(
        'INSERT INTO channel_members (channel_id, member_id, name, role, cursor_seq, joined_at) VALUES (?, ?, ?, ?, 0, ?)',
      )
      .run(channelId, memberId, name, role, now())
  }

  listMembers(channelId: string): ChannelMember[] {
    const rows = this.db
      .prepare('SELECT * FROM channel_members WHERE channel_id = ? ORDER BY joined_at ASC')
      .all(channelId) as Array<Record<string, unknown>>
    return rows.map((r) => ({
      channelId: r.channel_id as string,
      memberId: r.member_id as string,
      name: (r.name as string) || (r.member_id as string),
      role: r.role as ChannelRole,
      cursorSeq: Number(r.cursor_seq ?? 0),
      joinedAt: r.joined_at as number,
    }))
  }

  isMember(channelId: string, memberId: string): boolean {
    return Boolean(
      this.db.prepare('SELECT 1 FROM channel_members WHERE channel_id = ? AND member_id = ?').get(channelId, memberId),
    )
  }

  /** 更新成员游标到指定 seq（clamp 在频道当前最大 seq） */
  advanceCursor(channelId: string, memberId: string, seq: number): void {
    const max = this.maxSeq(channelId)
    const target = Math.max(0, Math.min(seq, max))
    this.db
      .prepare('UPDATE channel_members SET cursor_seq = ? WHERE channel_id = ? AND member_id = ?')
      .run(target, channelId, memberId)
  }

  // ==================== 消息（有序流 + 游标增量） ====================

  private maxSeq(channelId: string): number {
    const row = this.db
      .prepare('SELECT COALESCE(MAX(seq), 0) AS m FROM channel_messages WHERE channel_id = ?')
      .get(channelId) as { m: number }
    return Number(row.m ?? 0)
  }

  postMessage(channelId: string, sender: string, kind: string, payload: unknown): ChannelMessage {
    const row = this.db
      .prepare('INSERT INTO channel_messages (channel_id, sender, kind, payload, ts) VALUES (?, ?, ?, ?, ?)')
      .run(channelId, sender, kind, JSON.stringify(payload ?? null), now())
    return this.getMessage(channelId, Number(row.lastInsertRowid))!
  }

  getMessage(channelId: string, seq: number): ChannelMessage | undefined {
    const row = this.db
      .prepare('SELECT * FROM channel_messages WHERE channel_id = ? AND seq = ?')
      .get(channelId, seq) as Record<string, unknown> | undefined
    return row ? mapMessage(row) : undefined
  }

  /** 增量拉取：after = 上次游标，返回该频道 seq > after 的消息（默认限 200） */
  pullMessages(channelId: string, after: number, limit = 200): ChannelMessage[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM channel_messages WHERE channel_id = ? AND seq > ? ORDER BY seq ASC LIMIT ?',
      )
      .all(channelId, after, limit) as Array<Record<string, unknown>>
    return rows.map(mapMessage)
  }

  // ==================== 邀请 ====================

  createInvite(channelId: string, role: ChannelRole, expiresAt: number | null, maxUses: number | null): ChannelInvite {
    const id = genId('inv')
    this.db
      .prepare('INSERT INTO channel_invites (id, channel_id, role, expires_at, max_uses, used, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)')
      .run(id, channelId, role, expiresAt, maxUses, now())
    return this.getInvite(id)!
  }

  getInvite(id: string): ChannelInvite | undefined {
    const row = this.db.prepare('SELECT * FROM channel_invites WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!row) return undefined
    return {
      id: row.id as string,
      channelId: row.channel_id as string,
      role: row.role as ChannelRole,
      expiresAt: row.expires_at as number | null,
      maxUses: row.max_uses as number | null,
      used: row.used as number,
      createdAt: row.created_at as number,
    }
  }

  /** 兑换邀请：校验有效性并加入，返回频道。抛出 Error 表示邀请无效。 */
  redeemInvite(id: string, memberId: string, name: string): Channel {
    const inv = this.getInvite(id)
    if (!inv) throw new Error('邀请不存在')
    if (inv.expiresAt != null && now() > inv.expiresAt) throw new Error('邀请已过期')
    if (inv.maxUses != null && inv.used >= inv.maxUses) throw new Error('邀请已达使用上限')
    const channel = this.getChannel(inv.channelId)
    if (!channel) throw new Error('频道不存在')
    if (!this.isMember(inv.channelId, memberId)) {
      this.addMember(inv.channelId, memberId, name || memberId, inv.role)
    }
    this.db.prepare('UPDATE channel_invites SET used = used + 1 WHERE id = ?').run(id)
    return channel
  }

  emitChange() {
    try {
      ;(this.ctx as HostCtx).http.broadcast('channels', { ts: now() })
    } catch {
      /* 单测环境无 http */
    }
  }
}

function mapMessage(row: Record<string, unknown>): ChannelMessage {
  let payload: unknown = null
  try {
    payload = JSON.parse(row.payload as string)
  } catch {
    payload = row.payload
  }
  return {
    seq: Number(row.seq),
    channelId: row.channel_id as string,
    sender: row.sender as string,
    kind: row.kind as string,
    payload,
    ts: row.ts as number,
  }
}

export const name = 'channels'
export const inject = ['http', 'hub']

export function apply(ctx: Context) {
  const host = ctx as HostCtx
  const dbPath = join(process.cwd(), '.cordis', 'channels.sqlite')
  const channels = new ChannelService(ctx, dbPath).open()

  host.hub.register({
    id: 'channels',
    title: '频道',
    subtitle: '内网分布式群聊（有序消息流 + 成员 + 邀请）',
    plugin: 'channels',
    kind: 'channels',
  })

  const memberName = (def: string) => (def && def.trim() ? def.trim() : '访客')

  // ==================== 频道 ====================
  host.http.route('GET', '/api/channels', (_route) => {
    _route.send(200, { channels: channels.listChannels() })
  })

  host.http.route('POST', '/api/channels', async (route) => {
    try {
      const body = await route.json<{ name?: string; owner?: string }>()
      const name = String(body?.name ?? '').trim()
      if (!name) return route.send(400, { error: 'name 必填' })
      const owner = memberName(String(body?.owner ?? ''))
      const channel = channels.createChannel(name, owner)
      channels.emitChange()
      route.send(201, { channel })
    } catch (error) {
      route.send(400, { error: String(error) })
    }
  })

  host.http.route('GET', '/api/channels/:id', (route) => {
    const channel = channels.getChannel(route.params.id)
    if (!channel) return route.send(404, { error: 'unknown channel' })
    route.send(200, { channel })
  })

  // ==================== 成员 ====================
  host.http.route('GET', '/api/channels/:id/members', (route) => {
    const channel = channels.getChannel(route.params.id)
    if (!channel) return route.send(404, { error: 'unknown channel' })
    route.send(200, { members: channels.listMembers(route.params.id) })
  })

  // ==================== 消息 ====================
  host.http.route('GET', '/api/channels/:id/messages', (route) => {
    const { id } = route.params
    const afterRaw = Number(route.query.get('after') ?? 0)
    const after = Number.isFinite(afterRaw) && afterRaw >= 0 ? afterRaw : 0
    const messages = channels.pullMessages(id, after)
    const max = messages.length ? messages[messages.length - 1].seq : after
    route.send(200, { messages, latestSeq: max, channelId: id })
  })

  host.http.route('POST', '/api/channels/:id/messages', async (route) => {
    try {
      const { id } = route.params
      const body = await route.json<{ sender?: string; kind?: string; payload?: unknown }>()
      const sender = memberName(String(body?.sender ?? ''))
      const kind = String(body?.kind ?? 'text')
      const msg = channels.postMessage(id, sender, kind, body?.payload)
      channels.emitChange()
      route.send(201, { message: msg })
    } catch (error) {
      route.send(400, { error: String(error) })
    }
  })

  // ==================== 游标 ====================
  host.http.route('POST', '/api/channels/:id/cursor', async (route) => {
    try {
      const { id } = route.params
      const body = await route.json<{ memberId: string; seq?: number }>()
      const memberId = String(body?.memberId ?? '')
      if (!memberId) return route.send(400, { error: 'memberId 必填' })
      const seq = Number(body?.seq ?? 0)
      channels.advanceCursor(id, memberId, Number.isFinite(seq) && seq >= 0 ? seq : 0)
      route.send(200, { ok: true })
    } catch (error) {
      route.send(400, { error: String(error) })
    }
  })

  // ==================== 邀请 ====================
  host.http.route('POST', '/api/channels/:id/invites', async (route) => {
    try {
      const { id } = route.params
      if (!channels.getChannel(id)) return route.send(404, { error: 'unknown channel' })
      const body = await route.json<{ role?: string; expiresAt?: number; maxUses?: number }>()
      const role = body?.role === 'owner' ? 'owner' : 'member'
      const invite = channels.createInvite(
        id,
        role,
        Number.isFinite(Number(body?.expiresAt)) ? Number(body.expiresAt) : null,
        Number.isFinite(Number(body?.maxUses)) ? Number(body.maxUses) : null,
      )
      route.send(201, { invite })
    } catch (error) {
      route.send(400, { error: String(error) })
    }
  })

  host.http.route('POST', '/api/invites/:id/redeem', async (route) => {
    try {
      const body = await route.json<{ memberId: string; name?: string }>()
      const memberId = String(body?.memberId ?? '')
      if (!memberId) return route.send(400, { error: 'memberId 必填' })
      const channel = channels.redeemInvite(route.params.id, memberId, memberName(String(body?.name ?? '')))
      channels.emitChange()
      route.send(200, { channel })
    } catch (error) {
      route.send(400, { error: String(error) })
    }
  })
}
