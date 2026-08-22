import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import '../../types.ts'
import * as sessionView from './session-view.ts'
import { SessionViewService } from './session-view.ts'

function mockFetch(handlers: Record<string, (init?: RequestInit) => unknown>) {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init })
    for (const [prefix, handler] of Object.entries(handlers)) {
      if (url.includes(prefix)) {
        const body = handler(init)
        return {
          ok: true,
          status: 200,
          json: async () => body,
        } as Response
      }
    }
    return { ok: false, status: 404, json: async () => ({}) } as Response
  }) as typeof fetch
  return calls
}

test('refreshApprovals rehydrates mode and pending', async () => {
  mockFetch({
    '/api/sessions': () => ({ sessions: [] }),
    '/api/approvals': () => ({
      mode: 'hold',
      pending: [{ id: 'a1', name: 'bash', args: { command: 'ls' } }],
    }),
  })
  const ctx = new Context()
  await ctx.plugin(sessionView)
  const view = ctx.sessionView as SessionViewService
  await view.refreshApprovals()
  assert.equal(view.get().approvalMode, 'hold')
  assert.equal(view.get().approvals[0]?.id, 'a1')
})

test('setApprovalMode posts and updates state', async () => {
  const calls = mockFetch({
    '/api/sessions': () => ({ sessions: [] }),
    '/api/approvals/mode': () => ({ mode: 'hold' }),
    '/api/approvals': () => ({ mode: 'auto', pending: [] }),
  })
  const ctx = new Context()
  await ctx.plugin(sessionView)
  const view = ctx.sessionView as SessionViewService
  await view.setApprovalMode('hold')
  assert.equal(view.get().approvalMode, 'hold')
  assert.equal(
    calls.some((call) => call.url.includes('/api/approvals/mode') && call.init?.method === 'POST'),
    true,
  )
})

test('send inject posts kind without clearing running state', async () => {
  const calls = mockFetch({
    '/api/sessions': () => ({ sessions: [] }),
    '/api/approvals': () => ({ mode: 'auto', pending: [] }),
    '/api/sessions/s1/messages': () => ({ sessionId: 's1', queued: true }),
  })
  const ctx = new Context()
  await ctx.plugin(sessionView)
  const view = ctx.sessionView as SessionViewService
  view.ingest('s1', { type: 'session/open', version: 1, seq: 0, ts: 1 })
  view.setAgentStatus('running', 1)
  await view.send('nudge', 'inject')
  const injectCall = calls.find((call) => call.url.includes('/messages'))
  assert.ok(injectCall)
  assert.match(String(injectCall!.init?.body), /"kind":"inject"/)
  assert.equal(view.get().agentStatus, 'running')
  assert.equal(view.get().pending, true)
})

test('send wake keeps running after HTTP so WS agent/status owns idle', async () => {
  mockFetch({
    '/api/sessions': () => ({ sessions: [{ id: 's1', title: 'a', eventCount: 1, updatedAt: 1 }] }),
    '/api/sessions/s1?turns=': () => ({
      id: 's1',
      events: [{ type: 'session/open', version: 1, seq: 0, ts: 1 }],
      hasMore: false,
      totalTurns: 0,
    }),
    '/api/approvals': () => ({ mode: 'auto', pending: [] }),
    '/api/sessions/s1/messages': () => ({ sessionId: 's1', text: 'ok' }),
  })
  const ctx = new Context()
  await ctx.plugin(sessionView)
  const view = ctx.sessionView as SessionViewService
  view.ingest('s1', { type: 'session/open', version: 1, seq: 0, ts: 1 })
  await view.send('hi')
  assert.equal(view.get().agentStatus, 'running')
  assert.equal(view.get().pending, true)
  view.setAgentStatus('idle')
  assert.equal(view.get().agentStatus, 'idle')
  assert.equal(view.get().pending, false)
})

test('inspectCall switches to trajectory with focus', async () => {
  mockFetch({
    '/api/sessions': () => ({ sessions: [] }),
    '/api/approvals': () => ({ mode: 'auto', pending: [] }),
  })
  const ctx = new Context()
  await ctx.plugin(sessionView)
  const view = ctx.sessionView as SessionViewService
  view.inspectCall('c1')
  assert.equal(view.get().view, 'debug')
  assert.equal(view.get().focusCallId, 'c1')
})

test('ingest coalesces consecutive chunks and skips trajectory on chat view', async () => {
  mockFetch({
    '/api/sessions': () => ({ sessions: [] }),
    '/api/approvals': () => ({ mode: 'auto', pending: [] }),
  })
  const ctx = new Context()
  await ctx.plugin(sessionView)
  const view = ctx.sessionView as SessionViewService
  view.ingest('s1', { type: 'session/open', version: 1, seq: 0, ts: 1 })
  view.ingest('s1', { type: 'user/message', text: 'hi', seq: 1, ts: 2 })
  const trajBefore = view.get().trajectory
  view.ingest('s1', { type: 'assistant/chunk', text: 'hel', seq: 2, ts: 3 })
  view.ingest('s1', { type: 'assistant/chunk', text: 'lo', seq: 3, ts: 4 })
  assert.equal(view.get().events.filter((event) => event.type === 'assistant/chunk').length, 1)
  assert.equal(
    view.get().events.find((event) => event.type === 'assistant/chunk')?.type === 'assistant/chunk' &&
      (view.get().events.find((event) => event.type === 'assistant/chunk') as { text: string }).text,
    'hello',
  )
  assert.equal(view.get().trajectory, trajBefore)
  const assistant = view.get().nodes.find((node) => node.kind === 'reply')
  assert.equal(assistant?.kind === 'reply' && assistant.parts[0]?.kind === 'assistant' && assistant.parts[0].text, 'hello')
  assert.equal(assistant?.kind === 'reply' && assistant.streaming, true)

  view.ingest('s1', { type: 'assistant/message', text: 'hello', seq: 4, ts: 5 })
  assert.equal(view.get().events.some((event) => event.type === 'assistant/chunk'), false)
  // chat 视图不投影 trajectory
  assert.equal(view.get().trajectory.length, 0)
})

test('load fetches full session turns and skips trajectory until ensureTrajectory', async () => {
  const calls: string[] = []
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    calls.push(url)
    if (url.includes('/api/sessions/s1/trajectory')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 's1',
          rows: [{ id: 'tr-4', seq: 4, turn: 0, step: null, depth: 0, type: 'assistant/message', summary: 'ab' }],
          hasMore: false,
          totalTurns: 1,
        }),
      } as Response
    }
    if (url.includes('/api/sessions/s1?turns=')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 's1',
          events: [
            { type: 'session/open', version: 1, seq: 0, ts: 1 },
            { type: 'user/message', text: 'hi', seq: 1, ts: 2 },
            { type: 'assistant/chunk', text: 'a', seq: 2, ts: 3 },
            { type: 'assistant/chunk', text: 'b', seq: 3, ts: 4 },
            { type: 'assistant/message', text: 'ab', seq: 4, ts: 5 },
          ],
          hasMore: false,
          totalTurns: 1,
        }),
      } as Response
    }
    if (url.includes('/api/sessions') && !url.includes('/s1')) {
      return { ok: true, status: 200, json: async () => ({ sessions: [] }) } as Response
    }
    if (url.includes('/api/approvals')) {
      return { ok: true, status: 200, json: async () => ({ mode: 'auto', pending: [] }) } as Response
    }
    return { ok: false, status: 404, json: async () => ({}) } as Response
  }) as typeof fetch
  const ctx = new Context()
  await ctx.plugin(sessionView)
  const view = ctx.sessionView as SessionViewService
  await view.load('s1', { view: 'chat', wait: true })
  assert.equal(calls.some((url) => url.includes('turns=all')), true)
  assert.equal(view.get().events.some((event) => event.type === 'assistant/chunk'), false)
  assert.equal(view.get().trajectory.length, 0)
  assert.equal(
    view.get().nodes.some(
      (node) =>
        node.kind === 'reply' &&
        node.parts.some((part) => part.kind === 'assistant' && part.text === 'ab'),
    ),
    true,
  )
  await view.ensureTrajectory()
  assert.equal(calls.some((url) => url.includes('/trajectory?turns=')), true)
  assert.equal(view.get().trajectory.length, 1)
  assert.equal(calls.some((url) => url.includes('turns=24')), false)
})

test('fetchEventDetail and fetchEventRequest hit fine-grained APIs', async () => {
  const calls: string[] = []
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    calls.push(url)
    if (url.endsWith('/api/sessions/s1/events/4/request')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 's1', seq: 4, messages: [{ role: 'user', content: 'hi' }] }),
      } as Response
    }
    if (url.endsWith('/api/sessions/s1/events/4')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 's1',
          event: { type: 'assistant/message', text: 'ab', seq: 4, ts: 5 },
        }),
      } as Response
    }
    if (url.includes('/api/sessions')) {
      return { ok: true, status: 200, json: async () => ({ sessions: [] }) } as Response
    }
    if (url.includes('/api/approvals')) {
      return { ok: true, status: 200, json: async () => ({ mode: 'auto', pending: [] }) } as Response
    }
    return { ok: false, status: 404, json: async () => ({}) } as Response
  }) as typeof fetch
  const ctx = new Context()
  await ctx.plugin(sessionView)
  const view = ctx.sessionView as SessionViewService
  view.ingest('s1', { type: 'session/open', version: 1, seq: 0, ts: 1 })
  const event = await view.fetchEventDetail(4)
  assert.equal(event?.type, 'assistant/message')
  const request = await view.fetchEventRequest(4)
  assert.equal(request[0]?.content, 'hi')
  assert.equal(calls.some((url) => url.includes('/events/4/request')), true)
})

test('load keeps previous chat visible until new session fetch resolves', async () => {
  let release!: (value: unknown) => void
  const gate = new Promise((resolve) => {
    release = resolve
  })
  let emptyFetchStarted = false
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/sessions/empty?turns=')) {
      emptyFetchStarted = true
      await gate
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'empty',
          events: [{ type: 'session/open', version: 1, seq: 0, ts: 1 }],
          hasMore: false,
          totalTurns: 0,
        }),
      } as Response
    }
    if (url.includes('/api/sessions/busy?turns=')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'busy',
          events: [
            { type: 'session/open', version: 1, seq: 0, ts: 1 },
            { type: 'user/message', text: 'hi', seq: 1, ts: 2 },
            { type: 'assistant/message', text: 'yo', seq: 2, ts: 3 },
          ],
          hasMore: false,
          totalTurns: 1,
        }),
      } as Response
    }
    if (url.includes('/api/sessions')) {
      return { ok: true, status: 200, json: async () => ({ sessions: [] }) } as Response
    }
    if (url.includes('/api/approvals')) {
      return { ok: true, status: 200, json: async () => ({ mode: 'auto', pending: [] }) } as Response
    }
    return { ok: false, status: 404, json: async () => ({}) } as Response
  }) as typeof fetch

  const ctx = new Context()
  await ctx.plugin(sessionView)
  const view = ctx.sessionView as SessionViewService
  await view.load('busy', { view: 'chat', wait: true })
  assert.equal(view.get().nodes.length > 0, true)
  const prevNodes = view.get().nodes.length

  // 切到空会话：网络返回前不闪空；仍立刻换 sessionId 并开始拉取
  await view.load('empty', { view: 'chat' })
  assert.equal(view.get().sessionId, 'empty')
  assert.equal(view.get().switchingSession, true)
  assert.equal(view.get().nodes.length, prevNodes)
  assert.equal(emptyFetchStarted, true)
  release(undefined)
  await new Promise((r) => setTimeout(r, 0))
  assert.equal(view.get().sessionId, 'empty')
  assert.equal(view.get().switchingSession, false)
  assert.equal(view.get().nodes.some((node) => node.kind === 'user'), false)
})

test('second load of same session hits memory cache without waiting on fetch', async () => {
  let fetches = 0
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/sessions/s1?turns=')) {
      fetches += 1
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 's1',
          events: [
            { type: 'session/open', version: 1, seq: 0, ts: 1 },
            { type: 'user/message', text: 'hi', seq: 1, ts: 2 },
          ],
          hasMore: false,
          totalTurns: 1,
        }),
      } as Response
    }
    if (url.includes('/api/sessions')) {
      return { ok: true, status: 200, json: async () => ({ sessions: [] }) } as Response
    }
    if (url.includes('/api/approvals')) {
      return { ok: true, status: 200, json: async () => ({ mode: 'auto', pending: [] }) } as Response
    }
    return { ok: false, status: 404, json: async () => ({}) } as Response
  }) as typeof fetch

  const ctx = new Context()
  await ctx.plugin(sessionView)
  const view = ctx.sessionView as SessionViewService
  await view.load('s1', { view: 'chat', wait: true })
  await view.load('s1', { view: 'chat' })
  // 首次 + 后台 revalidate；同步路径已用缓存，nodes 立刻可用
  assert.equal(view.get().nodes.some((node) => node.kind === 'user'), true)
  assert.equal(fetches >= 1, true)
})

test('loadOlder prepends earlier turns', async () => {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/sessions/s1/events?beforeSeq=')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 's1',
          events: [
            { type: 'user/message', text: 'old', seq: 1, ts: 1 },
            { type: 'assistant/message', text: 'old-a', seq: 2, ts: 2 },
          ],
          hasMore: false,
          totalTurns: 2,
        }),
      } as Response
    }
    if (url.includes('/api/sessions/s1?turns=')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 's1',
          events: [
            { type: 'user/message', text: 'new', seq: 3, ts: 3 },
            { type: 'assistant/message', text: 'new-a', seq: 4, ts: 4 },
          ],
          hasMore: true,
          totalTurns: 2,
        }),
      } as Response
    }
    if (url.includes('/api/sessions')) {
      return { ok: true, status: 200, json: async () => ({ sessions: [] }) } as Response
    }
    if (url.includes('/api/approvals')) {
      return { ok: true, status: 200, json: async () => ({ mode: 'auto', pending: [] }) } as Response
    }
    return { ok: false, status: 404, json: async () => ({}) } as Response
  }) as typeof fetch
  const ctx = new Context()
  await ctx.plugin(sessionView)
  const view = ctx.sessionView as SessionViewService
  await view.load('s1', { view: 'chat', wait: true })
  assert.equal(view.get().hasMoreOlder, true)
  await view.loadOlder()
  const first = view.get().nodes[0]
  assert.equal(first?.kind, 'user')
  assert.equal(first && first.kind === 'user' ? first.text : undefined, 'old')
  assert.equal(view.get().hasMoreOlder, false)
})

test('deleteSession clears active session when list empty', async () => {
  const calls: Array<{ url: string; method?: string }> = []
  let sessions: Array<{ id: string; title: string; eventCount: number; updatedAt: number }> = [
    { id: 's1', title: 'ping', eventCount: 2, updatedAt: 1 },
  ]
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    calls.push({ url, method })
    if (url.endsWith('/api/sessions') && method === 'GET') {
      return { ok: true, status: 200, json: async () => ({ sessions }) } as Response
    }
    if (url.includes('/api/sessions/s1') && method === 'DELETE') {
      sessions = []
      return { ok: true, status: 200, json: async () => ({ ok: true, id: 's1' }) } as Response
    }
    if (url.includes('/api/approvals')) {
      return { ok: true, status: 200, json: async () => ({ mode: 'auto', pending: [] }) } as Response
    }
    return { ok: false, status: 404, json: async () => ({}) } as Response
  }) as typeof fetch

  const ctx = new Context()
  await ctx.plugin(sessionView)
  const view = ctx.sessionView as SessionViewService
  view.ingest('s1', { type: 'session/open', version: 1, seq: 0, ts: 1 })
  await view.refreshSessions()
  assert.equal(view.get().sessions.length, 1)
  await view.deleteSession('s1')
  assert.equal(calls.some((call) => call.method === 'DELETE'), true)
  assert.equal(view.get().sessionId, null)
  assert.equal(view.get().sessions.length, 0)
})

test('deleteSession removes from list before DELETE resolves', async () => {
  let resolveDelete!: (value: Response) => void
  const deleteGate = new Promise<Response>((resolve) => {
    resolveDelete = resolve
  })
  let sessions: Array<{ id: string; title: string; eventCount: number; updatedAt: number }> = [
    { id: 's1', title: 'a', eventCount: 1, updatedAt: 2 },
    { id: 's2', title: 'b', eventCount: 1, updatedAt: 1 },
  ]
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    if (url.endsWith('/api/sessions') && method === 'GET') {
      return { ok: true, status: 200, json: async () => ({ sessions }) } as Response
    }
    if (url.includes('/api/sessions/s1') && method === 'DELETE') {
      return deleteGate
    }
    if (url.includes('/api/approvals')) {
      return { ok: true, status: 200, json: async () => ({ mode: 'auto', pending: [] }) } as Response
    }
    return { ok: false, status: 404, json: async () => ({}) } as Response
  }) as typeof fetch

  const ctx = new Context()
  await ctx.plugin(sessionView)
  const view = ctx.sessionView as SessionViewService
  await view.refreshSessions()
  const pending = view.deleteSession('s1')
  assert.equal(view.get().sessions.map((row) => row.id).join(','), 's2')
  sessions = [{ id: 's2', title: 'b', eventCount: 1, updatedAt: 1 }]
  resolveDelete({ ok: true, status: 200, json: async () => ({ ok: true, id: 's1' }) } as Response)
  await pending
  assert.equal(view.get().sessions.map((row) => row.id).join(','), 's2')
})
