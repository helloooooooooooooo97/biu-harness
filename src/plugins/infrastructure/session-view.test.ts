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

test('inspectCall switches to trajectory with focus', async () => {
  mockFetch({
    '/api/sessions': () => ({ sessions: [] }),
    '/api/approvals': () => ({ mode: 'auto', pending: [] }),
  })
  const ctx = new Context()
  await ctx.plugin(sessionView)
  const view = ctx.sessionView as SessionViewService
  view.inspectCall('c1')
  assert.equal(view.get().view, 'trajectory')
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
  const assistant = view.get().nodes.find((node) => node.kind === 'assistant')
  assert.equal(assistant?.kind === 'assistant' && assistant.text, 'hello')
  assert.equal(assistant?.kind === 'assistant' && assistant.streaming, true)

  view.ingest('s1', { type: 'assistant/message', text: 'hello', seq: 4, ts: 5 })
  assert.equal(view.get().events.some((event) => event.type === 'assistant/chunk'), false)
  // chat 视图不投影 trajectory
  assert.equal(view.get().trajectory.length, 0)
})

test('load fetches tail turns and skips trajectory until ensureTrajectory', async () => {
  const calls: string[] = []
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    calls.push(url)
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
  await view.load('s1', { view: 'chat' })
  assert.equal(calls.some((url) => url.includes('turns=24')), true)
  assert.equal(view.get().events.some((event) => event.type === 'assistant/chunk'), false)
  assert.equal(view.get().trajectory.length, 0)
  assert.equal(view.get().nodes.some((node) => node.kind === 'assistant' && node.text === 'ab'), true)
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
  await view.load('s1', { view: 'chat' })
  assert.equal(view.get().hasMoreOlder, true)
  await view.loadOlder()
  assert.equal(view.get().nodes[0]?.kind === 'user' && view.get().nodes[0].text, 'old')
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
