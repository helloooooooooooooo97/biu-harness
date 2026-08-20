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
