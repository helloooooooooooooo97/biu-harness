import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from 'cordis'
import { buildDeliverText, coerceAssigneeArg, computeBlocked, computeBlockedBy, computeTurnUsage, depsSatisfied, deriveExecution, deriveExecutionFromReports, reportBackToCreator, sumReportUsage, TasksService } from './index.ts'

test('tasks sqlite crud and status move', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tasks-'))
  const path = join(dir, 'tasks.sqlite')
  try {
    const ctx = new Context()
    const tasks = new TasksService(ctx, path).open()
    const a = tasks.create({
      title: '写需求',
      creator: { kind: 'user', name: '用户' },
    })
    assert.equal(a.status, 'todo')
    assert.equal(a.creator.name, '用户')
    assert.equal(a.assignee, null)
    assert.equal(a.assignedAt, null)
    assert.equal(a.description, '')

    const b = tasks.update(a.id, {
      status: 'doing',
      priority: 'high',
      description: '把需求写清楚',
      notes: '明天跟进',
      assignee: { kind: 'agent', sessionId: 'sess-1', name: 'Worker-A', mascot: { shape: 'blob', color: 'cyan' } },
    })
    assert.equal(b.status, 'doing')
    assert.equal(b.priority, 'high')
    assert.equal(b.description, '把需求写清楚')
    assert.equal(b.notes, '明天跟进')
    assert.equal(b.assignee?.sessionId, 'sess-1')
    assert.ok(b.assignedAt && b.assignedAt > 0)

    const listed = tasks.list({ status: 'doing' })
    assert.equal(listed.length, 1)
    assert.equal(listed[0]?.id, a.id)
    assert.equal(listed[0]?.creator.name, '用户')
    assert.equal(tasks.delete(a.id), true)
    assert.equal(tasks.list().length, 0)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('coerceAssigneeArg accepts actor object, sessionId string, and person name', async () => {
  const host = { sessions: undefined } as never
  const actor = await coerceAssigneeArg(host, {
    kind: 'agent',
    sessionId: '856ffdc2-d00f-42e9-b084-d3d67a9c3e07',
    name: 'Cordis·后端开发',
    mascot: { shape: 'pebble', color: 'magenta', eye: 11 },
  })
  assert.equal(actor?.kind, 'agent')
  assert.equal(actor?.sessionId, '856ffdc2-d00f-42e9-b084-d3d67a9c3e07')
  assert.equal(actor?.name, 'Cordis·后端开发')
  assert.equal(actor?.mascot?.color, 'magenta')
  assert.notEqual(actor?.name, '[object Object]')

  const asJson = await coerceAssigneeArg(
    host,
    JSON.stringify({
      kind: 'agent',
      sessionId: '856ffdc2-d00f-42e9-b084-d3d67a9c3e07',
      name: 'Cordis·后端开发',
    }),
  )
  assert.equal(asJson?.sessionId, '856ffdc2-d00f-42e9-b084-d3d67a9c3e07')
  assert.equal(asJson?.name, 'Cordis·后端开发')

  const byId = await coerceAssigneeArg(host, '856ffdc2-d00f-42e9-b084-d3d67a9c3e07')
  assert.equal(byId?.kind, 'agent')
  assert.equal(byId?.sessionId, '856ffdc2-d00f-42e9-b084-d3d67a9c3e07')

  const person = await coerceAssigneeArg(host, 'Alice')
  assert.deepEqual(person, { kind: 'user', name: 'Alice' })

  assert.equal(await coerceAssigneeArg(host, null), null)
})

test('deriveExecution only uses session turn events, not agents.isBusy', () => {
  assert.equal(deriveExecution(undefined).status, 'idle')
  assert.equal(deriveExecution([]).status, 'idle')

  const running = deriveExecution([
    { type: 'turn/start', turn: 1, ts: 1 },
    { type: 'assistant/chunk', text: 'hi', ts: 2 },
  ])
  assert.equal(running.status, 'running')
  assert.equal(running.turn, 1)
  assert.equal(running.assistantText, 'hi')

  const idle = deriveExecution([
    { type: 'turn/start', turn: 2, ts: 1 },
    { type: 'assistant/message', text: 'done', ts: 2 },
    { type: 'turn/end', turn: 2, reason: 'complete', ts: 3 },
  ])
  assert.equal(idle.status, 'idle')
  assert.equal(idle.reason, 'complete')
  assert.equal(idle.assistantText, 'done')
})

test('deriveExecutionFromReports uses latest report status', () => {
  // 无任何上报：绝不推断为完成（无 complete reason）
  const none = deriveExecutionFromReports([])
  assert.equal(none.status, 'idle')
  assert.equal(none.reason, undefined)
  const none2 = deriveExecutionFromReports(undefined)
  assert.equal(none2.status, 'idle')
  assert.equal(none2.reason, undefined)

  // 只有 doing -> running
  const doing = deriveExecutionFromReports([
    { sessionId: 's1', turn: 1, status: 'doing', note: '排查中', ts: 1 },
  ])
  assert.equal(doing.status, 'running')
  assert.equal(doing.turn, 1)
  assert.equal(doing.assistantText, '排查中')

  // 最新是 done -> idle + complete
  const done = deriveExecutionFromReports([
    { sessionId: 's1', turn: 1, status: 'doing', note: '排查中', ts: 1 },
    { sessionId: 's1', turn: 2, status: 'done', note: '搞定', ts: 2 },
  ])
  assert.equal(done.status, 'idle')
  assert.equal(done.reason, 'complete')
  assert.equal(done.turn, 2)
  assert.equal(done.assistantText, '搞定')

  // 后 report 覆盖前一个 done
  const reopened = deriveExecutionFromReports([
    { sessionId: 's1', turn: 2, status: 'done', note: '搞定', ts: 2 },
    { sessionId: 's1', turn: 3, status: 'doing', note: '又发现新问题', ts: 3 },
  ])
  assert.equal(reopened.status, 'running')
})

test('task_report persists reports_json via report()', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tasks-'))
  const path = join(dir, 'tasks.sqlite')
  try {
    const ctx = new Context()
    const tasks = new TasksService(ctx, path).open()
    const t = tasks.create({
      title: '实现 task_report',
      creator: { kind: 'user', name: '用户' },
    })

    const afterDoing = tasks.report(t.id, {
      sessionId: 'sess-agent-1',
      sessionName: 'Agent-A',
      turn: 1,
      status: 'doing',
      note: '第一轮：写工具声明',
      ts: 100,
    })
    assert.equal(afterDoing.reports?.length, 1)
    assert.equal(afterDoing.reports?.[0]?.status, 'doing')

    const afterDone = tasks.report(t.id, {
      sessionId: 'sess-agent-1',
      sessionName: 'Agent-A',
      turn: 2,
      status: 'done',
      note: '第二轮：完成并验证',
      ts: 200,
    })
    assert.equal(afterDone.reports?.length, 2)
    assert.equal(afterDone.reports?.[1]?.status, 'done')

    // 持久化后可重新读取（独立 Context，模拟宿主重启）
    const reopened = new TasksService(new Context(), path).open().get(t.id)
    assert.equal(reopened?.reports?.length, 2)
    assert.equal(reopened?.reports?.[1]?.status, 'done')
    assert.equal(reopened?.reports?.[1]?.note, '第二轮：完成并验证')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('blocked derives from unfinished dependency', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tasks-'))
  const path = join(dir, 'tasks.sqlite')
  try {
    const ctx = new Context()
    const tasks = new TasksService(ctx, path).open()
    const a = tasks.create({ title: '前置A', creator: { kind: 'user', name: '用户' } })
    const b = tasks.create({ title: '后置B', creator: { kind: 'user', name: '用户' }, dependsOn: [a.id] })
    const byId = (id: string) => tasks.get(id)

    // B 依赖 A；A 是 todo（未完成）→ B blocked
    assert.equal(computeBlocked(b, byId), true)
    // 完成 A 后（通过新查询读到 done），B 解除阻塞
    tasks.update(a.id, { status: 'done' })
    const bAfter = tasks.get(b.id)!
    assert.equal(computeBlocked(bAfter, byId), false)
    // A 的依赖清空后 B 也不阻塞（无依赖）
    assert.equal(computeBlocked({ ...b, dependsOn: [] }, byId), false)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('blocked only applies to todo, never doing/done', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tasks-'))
  const path = join(dir, 'tasks.sqlite')
  try {
    const ctx = new Context()
    const tasks = new TasksService(ctx, path).open()
    const a = tasks.create({ title: '前置', creator: { kind: 'user', name: '用户' } })
    const b = tasks.create({ title: '后置', creator: { kind: 'user', name: '用户' }, dependsOn: [a.id] })
    const byId = (id: string) => tasks.get(id)
    // 即使依赖都未完成，doing/done 也不阻塞
    assert.equal(computeBlocked({ ...b, status: 'doing' }, byId), false)
    assert.equal(computeBlocked({ ...b, status: 'done' }, byId), false)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('dependency cycle is rejected', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tasks-'))
  const path = join(dir, 'tasks.sqlite')
  try {
    const ctx = new Context()
    const tasks = new TasksService(ctx, path).open()
    const a = tasks.create({ title: 'A', creator: { kind: 'user', name: '用户' } })
    const b = tasks.create({ title: 'B', creator: { kind: 'user', name: '用户' }, dependsOn: [a.id] })
    // 给 A 加依赖 B 会成环 A->B->A → 应抛错
    assert.throws(() => tasks.update(a.id, { dependsOn: [b.id] }), /cycle/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('tree depth limited to MAX_DEPTH', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tasks-'))
  const path = join(dir, 'tasks.sqlite')
  try {
    const ctx = new Context()
    const tasks = new TasksService(ctx, path).open()
    const n0 = tasks.create({ title: 'L0', creator: { kind: 'user', name: '用户' } })
    const n1 = tasks.create({ title: 'L1', creator: { kind: 'user', name: '用户' }, parentId: n0.id })
    const n2 = tasks.create({ title: 'L2', creator: { kind: 'user', name: '用户' }, parentId: n1.id })
    const n3 = tasks.create({ title: 'L3', creator: { kind: 'user', name: '用户' }, parentId: n2.id })
    assert.equal(n0.depth, 0)
    assert.equal(n1.depth, 1)
    assert.equal(n2.depth, 2)
    assert.equal(n3.depth, 3)
    // 超出 MAX_DEPTH=3：L4 挂到 L3 下应抛错
    assert.throws(() => tasks.create({ title: 'L4', creator: { kind: 'user', name: '用户' }, parentId: n3.id }), /MAX_DEPTH/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('blockedBy lists the blocking chain (recursive)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tasks-'))
  const path = join(dir, 'tasks.sqlite')
  try {
    const ctx = new Context()
    const tasks = new TasksService(ctx, path).open()
    const a = tasks.create({ title: 'A', creator: { kind: 'user', name: '用户' } })
    const b = tasks.create({ title: 'B', creator: { kind: 'user', name: '用户' }, dependsOn: [a.id] })
    const c = tasks.create({ title: 'C', creator: { kind: 'user', name: '用户' }, dependsOn: [b.id] })
    const byId = (id: string) => tasks.get(id)

    // C 依赖 B，B 依赖 A；A 未完成 → C 的阻塞链包含 B 和 A
    const cBlocker = tasks.get(c.id)!
    assert.deepEqual(computeBlockedBy(cBlocker, byId), [b.id, a.id])
    // B 被阻塞：只有 A
    const bBlocker = tasks.get(b.id)!
    assert.deepEqual(computeBlockedBy(bBlocker, byId), [a.id])
    // 完成 A 后，B 不再阻塞，C 只被 B 阻塞
    tasks.update(a.id, { status: 'done' })
    const c2 = tasks.get(c.id)!
    assert.deepEqual(computeBlockedBy(c2, byId), [b.id])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('buildDeliverText renders a派工 message with task key fields', () => {
  const text = buildDeliverText({
    id: 'task_x',
    title: '写需求文档',
    status: 'todo',
    priority: 'high',
    difficulty: 'med',
    dueAt: 1700000000000,
    description: '要把需求写清楚',
    notes: '明天跟进',
    project: 'cordis-web',
    tags: ['后端', '文档'],
    parentId: null,
    dependsOn: [],
    depth: 1,
    sort: 1,
    createdAt: 1,
    updatedAt: 1,
    creator: { kind: 'agent', sessionId: 'boss', name: 'Boss' },
    assignee: { kind: 'agent', sessionId: 'worker', name: 'Worker' },
    assignedAt: 1,
  })
  assert.match(text, /写需求文档/)
  assert.match(text, /状态：todo/)
  assert.match(text, /优先级：high/)
  assert.match(text, /难度：med/)
  assert.match(text, /项目：cordis-web/)
  assert.match(text, /要把需求写清楚/)
  assert.match(text, /明天跟进/)
  assert.match(text, /task_x/)
})

test('reportBackToCreator sends a progress message to the assigner session via sendMessage (wake-first)', async () => {
  const sent: Array<{ target: string; text: string; wait: boolean }> = []
  const host = {
    sessions: {
      sendMessage: async (target: string, text: string, opts: { wait?: boolean }) => {
        sent.push({ target, text, wait: opts?.wait ?? true })
        return { text: '', steps: [] }
      },
    },
  }
  const row = {
    id: 'task_y',
    title: '后端改造',
    creator: { kind: 'agent' as const, sessionId: 'assigner-session', name: '分配人' },
  }
  const res = await reportBackToCreator(
    host as never,
    row as never,
    { sessionId: 'worker-session', sessionName: 'worker', turn: 3, status: 'done', note: '改造完成', ts: 1 },
  )
  assert.equal(res.ok, true)
  assert.equal(res.sessionId, 'assigner-session')
  assert.equal(sent.length, 1)
  assert.equal(sent[0]!.target, 'assigner-session')
  // 与前端 sendMessage 同语义，wait=false 入队后立即返回、不阻塞上报方回合
  assert.equal(sent[0]!.wait, false)
  assert.match(sent[0]!.text, /后端改造/)
  assert.match(sent[0]!.text, /worker/)
  assert.match(sent[0]!.text, /已完成/)
  assert.match(sent[0]!.text, /改造完成/)
})

test('reportBackToCreator skips when creator has no session or is the reporter itself', async () => {
  let calls = 0
  const host = {
    sessions: {
      sendMessage: async () => {
        calls++
        return { text: '', steps: [] }
      },
    },
  }
  // 纯用户创建：无 session，跳过
  const userCreated = await reportBackToCreator(
    host as never,
    { creator: { kind: 'user' as const, name: '用户' } } as never,
    { sessionId: 'w', status: 'doing', turn: 1, ts: 1 },
  )
  assert.equal(userCreated.ok, false)
  // 分配人即上报人：跳过
  const self = await reportBackToCreator(
    host as never,
    { creator: { kind: 'agent' as const, sessionId: 'me', name: 'Me' } } as never,
    { sessionId: 'me', status: 'doing', turn: 1, ts: 1 },
  )
  assert.equal(self.ok, false)
  assert.equal(calls, 0)
})

test('computeTurnUsage aggregates assistant/message usage for a turn', () => {
  const events = [
    { type: 'turn/start', turn: 1, ts: 1 },
    { type: 'assistant/message', turn: 1, usage: { inputTokens: 10, outputTokens: 4, cacheReadTokens: 2, totalTokens: 16 } },
    { type: 'step/start', turn: 1, ts: 2 },
    { type: 'assistant/message', turn: 1, usage: { inputTokens: 3, outputTokens: 1 } },
    { type: 'turn/end', turn: 1, ts: 3 },
  ]
  const u = computeTurnUsage(events as unknown as Array<Record<string, unknown>>, 1)
  assert.deepEqual(u, { inputTokens: 13, outputTokens: 5, cacheReadTokens: 2, totalTokens: 20 })
  // non-matching turn / missing usage -> undefined
  assert.equal(computeTurnUsage(events as unknown as Array<Record<string, unknown>>, 2), undefined)
  assert.equal(computeTurnUsage([], 1), undefined)
})

test('sumReportUsage sums per-report usage with same (session,turn) dedupe', () => {
  const reports = [
    { sessionId: 's1', turn: 1, usage: { inputTokens: 10, outputTokens: 2, cacheReadTokens: 1, totalTokens: 13 } },
    // 同名 (s1, turn=1)：取后一次（覆盖，避免重复计费）
    { sessionId: 's1', turn: 1, usage: { inputTokens: 20, outputTokens: 4, cacheReadTokens: 2, totalTokens: 26 } },
    { sessionId: 's2', turn: 2, usage: { inputTokens: 5, outputTokens: 1, cacheReadTokens: 0, totalTokens: 6 } },
    // 无 usage（旧数据）跳过
    { sessionId: 's3', turn: 3 },
  ] as never
  assert.deepEqual(sumReportUsage(reports), {
    inputTokens: 25,
    outputTokens: 5,
    cacheReadTokens: 2,
    totalTokens: 32,
  })
  assert.equal(sumReportUsage(undefined), undefined)
})
