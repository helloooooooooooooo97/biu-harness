import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Context } from './context.ts'
import { buildServices, resolveOrder, type ServiceDef } from './service.ts'

// 本文件测依赖注入与拓扑排序：① 依赖链；② 排序规则；③ 缺失依赖；④ 循环依赖；⑤ 并行依赖。

test('依赖链按拓扑顺序实例化并注入依赖', () => {
  // 验证 agent-loop 依赖 config/session：实例化顺序正确、依赖被注入、服务可取出。
  const ctx = new Context()
  const created: string[] = []
  const session = { id: 's1' }
  // 服务配置
  const defs: ServiceDef[] = [
    { name: 'config', create: () => ({ model: 'deepseek-chat' }) },
    { name: 'session', create: (deps) => { created.push('session'); return session } },
    {
      name: 'agent-loop',
      deps: ['config', 'session'],
      create: (deps) => {
        created.push('agent-loop')
        return { model: (deps.config as { model: string }).model, session: deps.session }
      },
    },
  ]
  // 依赖构建
  buildServices(ctx, defs)

  assert.deepEqual(created, ['session', 'agent-loop'])
  const loop = ctx.get<{ model: string; session: unknown }>('agent-loop')
  assert.equal(loop.model, 'deepseek-chat')
  assert.equal(loop.session, session)
  assert.deepEqual(ctx.serviceNames, ['config', 'session', 'agent-loop'])
})

test('resolveOrder 返回依赖在前、无关服务保持输入顺序', () => {
  // 验证 Kahn 排序：db/logger 都排在 app 前，互相无关的服务保持输入顺序（确定性）。
  const order = resolveOrder([
    { name: 'app', deps: ['db', 'logger'], create: () => { } },
    { name: 'db', create: () => { } },
    { name: 'logger', create: () => { } },
  ])
  assert.ok(order.indexOf('db') < order.indexOf('app'))
  assert.ok(order.indexOf('logger') < order.indexOf('app'))
  assert.deepEqual(order, ['db', 'logger', 'app'])
})

test('缺少服务定义抛错', () => {
  // 验证依赖完整性：deps 指向未定义的服务时抛"缺少服务定义"，指名道姓。
  const defs: ServiceDef[] = [
    { name: 'app', deps: ['missing'], create: () => { } },
  ]
  assert.throws(() => resolveOrder(defs), /缺少服务定义: missing/)
})

test('循环依赖抛错', () => {
  // 验证环检测：a↔b 互相依赖时抛"循环依赖"并点名环内服务。
  const defs: ServiceDef[] = [
    { name: 'a', deps: ['b'], create: () => { } },
    { name: 'b', deps: ['a'], create: () => { } },
  ]
  assert.throws(() => resolveOrder(defs), /循环依赖/)
})

test('并行依赖的服务都能拿到', () => {
  // 验证依赖注入真正生效：repo 拿到 db 服务并能调用其方法。
  const ctx = new Context()
  buildServices(ctx, [
    { name: 'db', create: () => ({ url: 'sqlite://:memory:' }) },
    { name: 'repo', deps: ['db'], create: (deps) => ({ query: () => `db:${(deps.db as { url: string }).url}` }) },
  ])
  assert.equal(ctx.get<{ query: () => string }>('repo').query(), 'db:sqlite://:memory:')
})
