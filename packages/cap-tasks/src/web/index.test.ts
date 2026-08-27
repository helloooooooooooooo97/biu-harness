import { describe, expect, test } from 'vitest'
import { applyViewKeepMode, buildQueueRows, buildTreeRows, sortTasks } from './index.tsx'
import type { Task, TaskPriority, TaskStatus } from './index.tsx'

function makeTask(id: string, patch: Partial<Task> = {}): Task {
  return {
    id,
    title: `任务 ${id}`,
    status: 'todo',
    priority: 'med',
    difficulty: 'med',
    sort: 0,
    createdAt: 0,
    updatedAt: 0,
    tags: [],
    dependsOn: [],
    reports: [],
    ...patch,
  } as Task
}

describe('sortTasks（视图排序）', () => {
  const tasks = [
    makeTask('a', { priority: 'low', status: 'todo', createdAt: 100 }),
    makeTask('b', { priority: 'high', status: 'doing', createdAt: 300 }),
    makeTask('c', { priority: 'med', status: 'todo', createdAt: 200 }),
    makeTask('d', { priority: 'high', status: 'done', createdAt: 400 }),
  ]

  test('按优先级降序：high 在前，同级回退状态/截止', () => {
    const sorted = sortTasks(tasks, { field: 'priority', dir: 'desc' })
    const ids = sorted.map((t) => t.id)
    // high: b(doing), d(done)；med: c；low: a —— b 与 d 同为 high，整体降序下状态降序：done(2) 在 doing(1) 前
    expect(ids).toEqual(['d', 'b', 'c', 'a'])
  })

  test('默认状态复合排序：todo→doing→done，同级按优先级升序', () => {
    const sorted = sortTasks(tasks, { field: 'status', dir: 'asc' })
    const ids = sorted.map((t) => t.id)
    // todo: a(low), c(med) 按优先级升序 low 在前；doing: b；done: d
    expect(ids).toEqual(['a', 'c', 'b', 'd'])
  })

  test('按创建时间降序', () => {
    const sorted = sortTasks(tasks, { field: 'created', dir: 'desc' })
    expect(sorted.map((t) => t.id)).toEqual(['d', 'b', 'c', 'a'])
  })
})

describe('buildTreeRows（树形表格：同级保持排序，树结构不变）', () => {
  const tasks = [
    makeTask('p1', { parentId: '', priority: 'low' }),
    makeTask('c1', { parentId: 'p1', priority: 'high' }),
    makeTask('p2', { parentId: '', priority: 'high' }),
    makeTask('c2', { parentId: 'p1', priority: 'med' }),
  ]

  test('同级兄弟遵循排序后的传入顺序（父在前子随后）', () => {
    const sorted = sortTasks(tasks, { field: 'priority', dir: 'desc' })
    const rows = buildTreeRows(sorted, {})
    const ids = rows.map((t) => t.id)
    // 根层按排序：p2(high) 在 p1(low) 前；p1 的子树按排序：c1(high) 在 c2(med) 前
    expect(ids).toEqual(['p2', 'p1', 'c1', 'c2'])
  })
})

describe('buildQueueRows（队列：仅叶节点，组内保持排序）', () => {
  const tasks = [
    makeTask('p1', { parentId: '' }),
    makeTask('leafA', { parentId: 'p1', status: 'todo', priority: 'low' }),
    makeTask('leafB', { parentId: 'p1', status: 'todo', priority: 'high' }),
    makeTask('leafC', { parentId: '', status: 'todo', priority: 'med' }),
  ]

  test('只输出叶节点，组内按排序后的传入顺序', () => {
    const sorted = sortTasks(tasks, { field: 'priority', dir: 'desc' })
    const rows = buildQueueRows(sorted)
    const ids = rows.map((t) => t.id)
    // 父节点 p1 不展示；todo 组内：leafB(high) → leafC(med) → leafA(low)
    expect(ids).toEqual(['leafB', 'leafC', 'leafA'])
  })
})

describe('applyViewKeepMode（视图与查看模式解绑）', () => {
  test('套用已存筛选时保留当前呈现方式', () => {
    const kept = applyViewKeepMode(
      {
        mode: 'table',
        filter: { project: 'biu', tags: ['a'], time: '7d' },
        sort: { field: 'due', dir: 'asc' },
      },
      'board',
    )
    expect(kept.mode).toBe('board')
    expect(kept.filter.project).toBe('biu')
    expect(kept.sort.field).toBe('due')
  })
})

// 仅供类型引用，避免 unused import 告警
export type { TaskPriority as _TaskPriority, TaskStatus as _TaskStatus }
