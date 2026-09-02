import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import * as sessionView from './index.ts'
import { SessionViewService } from './index.ts'

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

test('setSessionTitle patches config title', async () => {
  let listed = '旧名'
  const calls = mockFetch({
    '/api/sessions/s1/config': () => ({ id: 's1' }),
    '/api/sessions': () => ({ sessions: [{ id: 's1', title: listed, eventCount: 1, updatedAt: 1 }] }),
    '/api/approvals': () => ({ mode: 'auto', pending: [] }),
  })
  const ctx = new Context()
  await ctx.plugin(sessionView)
  const view = ctx.sessionView as SessionViewService
  await view.refreshSessions()
  listed = '新名称'
  await view.setSessionTitle('s1', '  新名称  ')
  const patch = calls.find((call) => call.url.includes('/config') && call.init?.method === 'PATCH')
  assert.ok(patch)
  assert.match(String(patch!.init?.body), /"title":"新名称"/)
  assert.equal(view.get().sessions[0]?.title, '新名称')
})

test('setSessionTitle empty sends null title', async () => {
  const calls = mockFetch({
    '/api/sessions/s1/config': () => ({ id: 's1' }),
    '/api/sessions': () => ({ sessions: [{ id: 's1', title: '旧名', eventCount: 1, updatedAt: 1 }] }),
    '/api/approvals': () => ({ mode: 'auto', pending: [] }),
  })
  const ctx = new Context()
  await ctx.plugin(sessionView)
  const view = ctx.sessionView as SessionViewService
  await view.refreshSessions()
  await view.setSessionTitle('s1', '   ')
  const patch = calls.find((call) => call.url.includes('/config') && call.init?.method === 'PATCH')
  assert.ok(patch)
  assert.match(String(patch!.init?.body), /"title":null/)
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
  assert.equal(view.get().busySessions.s1, true)
  view.setAgentStatus('idle')
  assert.equal(view.get().agentStatus, 'idle')
  assert.equal(view.get().pending, false)
  assert.equal(view.get().busySessions.s1, undefined)
})

test('turn/end clears current busy promptly (no stale breathing state)', async () => {
  // 列表已不再 busy(false)，但因当前会话 pending 存在，旧 syncBusyFromSessions 的
  // pending 保护会卡死不删 → 侧栏持续呼吸态。turn/end 是回合结束的权威信号，应立即清 busy。
  mockFetch({
    '/api/sessions': () => ({ sessions: [{ id: 's1', title: 'a', busy: false, eventCount: 2, updatedAt: 1 }] }),
    '/api/approvals': () => ({ mode: 'auto', pending: [] }),
  })
  const ctx = new Context()
  await ctx.plugin(sessionView)
  const view = ctx.sessionView as SessionViewService
  view.ingest('s1', { type: 'session/open', version: 1, seq: 0, ts: 1 })
  view.setAgentStatus('running', 1)
  assert.equal(view.get().busySessions.s1, true)
  assert.equal(view.get().pending, true)
  // 回合结束：WS 推来 turn/end
  view.ingest('s1', { type: 'turn/end', turn: 1, reason: 'complete', seq: 2, ts: 2 })
  assert.equal(view.get().busySessions.s1, undefined)
  assert.equal(view.get().pending, false)
  assert.equal(view.get().agentStatus, 'idle')
  // 兜底轮询不再被 pending 卡死
  await view.refreshSessions()
  assert.equal(view.get().busySessions.s1, undefined)
  assert.equal(view.get().pending, false)
})

test('worker session busy cleared once list reports not busy', async () => {
  mockFetch({
    '/api/sessions': () => ({ sessions: [{ id: 'worker-9', title: 'w', busy: false, eventCount: 1, updatedAt: 1 }] }),
    '/api/approvals': () => ({ mode: 'auto', pending: [] }),
  })
  const ctx = new Context()
  await ctx.plugin(sessionView)
  const view = ctx.sessionView as SessionViewService
  view.ingest('live-1', { type: 'session/open', version: 1, seq: 0, ts: 1 })
  view.setAgentStatus('running', 0, 'worker-9')
  assert.equal(view.get().busySessions['worker-9'], true)
  assert.equal(view.get().pending, false)
  // worker 非当前会话，无 pending 保护，列表不 busy 即可兜底清掉
  await view.refreshSessions()
  assert.equal(view.get().busySessions['worker-9'], undefined)
})

test('setAgentStatus with other sessionId only updates busySessions', async () => {
  mockFetch({
    '/api/sessions': () => ({ sessions: [] }),
    '/api/approvals': () => ({ mode: 'auto', pending: [] }),
  })
  const ctx = new Context()
  await ctx.plugin(sessionView)
  const view = ctx.sessionView as SessionViewService
  view.ingest('live-1', { type: 'session/open', version: 1, seq: 0, ts: 1 })
  assert.equal(view.get().sessionId, 'live-1')
  view.setAgentStatus('running', 0, 'worker-2')
  assert.equal(view.get().agentStatus, 'idle')
  assert.equal(view.get().pending, false)
  assert.equal(view.get().busySessions['worker-2'], true)
  view.setAgentStatus('idle', undefined, 'worker-2')
  assert.equal(view.get().busySessions['worker-2'], undefined)
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
  assert.equal(view.get().view, 'chat')
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
        json: async () => ({
          id: 's1',
          seq: 4,
          messages: [{ role: 'user', content: 'hi' }],
          toolsTokens: 42,
        }),
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
  assert.equal(request.messages[0]?.content, 'hi')
  assert.equal(request.toolsTokens, 42)
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

test('ensureTrajectory keeps live index on chat route after new session navigate', async () => {
  let trajRows: Array<{ id: string; seq: number; turn: number; step: null; depth: number; type: string; summary: string }> = []
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/trajectory')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 's-new', rows: trajRows, hasMore: false, totalTurns: trajRows.length ? 1 : 0 }),
      } as Response
    }
    if (url.includes('/api/sessions/s-new?turns=')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 's-new',
          events: [{ type: 'session/open', version: 1, seq: 0, ts: 1 }],
          hasMore: false,
          totalTurns: 0,
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
  view.ingest('s-new', { type: 'session/open', version: 1, seq: 0, ts: 1 })
  await view.ensureTrajectory()
  assert.equal(view.get().view, 'chat')
  assert.equal(view.get().trajectory.length, 0)

  // 新建会话后 navigate(`/s/${id}`) 会 applyRoute chat，不应关掉轨迹订阅
  await view.applyRoute({ kind: 'session', sessionId: 's-new', view: 'chat' })
  assert.equal(view.get().view, 'chat')

  trajRows = [{ id: 'tr-1', seq: 1, turn: 0, step: null, depth: 0, type: 'user/message', summary: 'hi' }]
  view.ingest('s-new', { type: 'user/message', text: 'hi', seq: 1, ts: 2 })
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(view.get().trajectory.length, 1)
  assert.equal(view.get().view, 'chat')
})

test('forkCurrent inserts the child into the sidebar list', async () => {
  let sessions: Array<{
    id: string
    title: string
    eventCount: number
    updatedAt: number
    type?: string
    mascot?: { shape: string; color: string }
  }> = [{ id: 's1', title: 'keep', eventCount: 2, updatedAt: 1 }]
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    if (url.endsWith('/api/sessions') && method === 'GET') {
      return { ok: true, status: 200, json: async () => ({ sessions }) } as Response
    }
    if (url.includes('/api/sessions/s1/fork') && method === 'POST') {
      sessions = [
        { id: 's2', title: 'keep', eventCount: 2, updatedAt: 9, mascot: { shape: 'circle', color: '#111' } },
        { id: 's1', title: 'keep', eventCount: 2, updatedAt: 1 },
      ]
      return {
        ok: true,
        status: 201,
        json: async () => ({ id: 's2', parentId: 's1', type: 'chat', mascot: { shape: 'circle', color: '#111' } }),
      } as Response
    }
    if (url.includes('/api/sessions/s2')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 's2',
          events: [{ type: 'session/open', version: 1, seq: 0, ts: 1 }],
          hasMore: false,
        }),
      } as Response
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
  const childId = await view.forkCurrent()
  assert.equal(childId, 's2')
  assert.equal(view.get().sessionId, 's2')
  assert.equal(view.get().sessions.some((item) => item.id === 's2'), true)
})

test('home and module routes open the most recently updated chat', async () => {
  mockFetch({
    '/api/sessions': () => ({
      sessions: [
        { id: 'old', title: 'old', eventCount: 1, updatedAt: 1 },
        { id: 'new', title: 'new', eventCount: 1, updatedAt: 9 },
      ],
    }),
    '/api/sessions/new?turns=': () => ({
      id: 'new',
      events: [{ type: 'session/open', version: 1, seq: 0, ts: 1 }],
      hasMore: false,
      totalTurns: 0,
    }),
    '/api/approvals': () => ({ mode: 'auto', pending: [] }),
  })
  const ctx = new Context()
  await ctx.plugin(sessionView)
  const view = ctx.sessionView as SessionViewService
  await view.refreshSessions()
  await view.applyRoute({ kind: 'home' })
  assert.equal(view.get().sessionId, 'new')
  await view.applyRoute({ kind: 'module', moduleId: 'database', path: '/database' })
  assert.equal(view.get().sessionId, 'new')
})

test('sessions record routes do not switch the live session', async () => {
  mockFetch({
    '/api/sessions': () => ({
      sessions: [
        { id: 'old', title: 'old', eventCount: 1, updatedAt: 1 },
        { id: 'new', title: 'new', eventCount: 1, updatedAt: 9 },
      ],
    }),
    '/api/sessions/new?turns=': () => ({
      id: 'new',
      events: [{ type: 'session/open', version: 1, seq: 0, ts: 1 }],
      hasMore: false,
      totalTurns: 0,
    }),
    '/api/approvals': () => ({ mode: 'auto', pending: [] }),
  })
  const ctx = new Context()
  await ctx.plugin(sessionView)
  const view = ctx.sessionView as SessionViewService
  await view.refreshSessions()
  await view.applyRoute({ kind: 'home' })
  assert.equal(view.get().sessionId, 'new')
  await view.applyRoute({
    kind: 'record',
    moduleId: 'database',
    path: '/database',
    collection: '/sessions',
    recordId: 'old',
  })
  assert.equal(view.get().sessionId, 'new')
})
