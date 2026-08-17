import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Context } from './context.ts'
import { buildServices, resolveOrder, type ServiceDef } from './service.ts'

test('依赖链按拓扑顺序实例化并注入依赖', () => {
  const ctx = new Context()
  const created: string[] = []
  const session = { id: 's1' }
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
  buildServices(ctx, defs)
  assert.deepEqual(created, ['session', 'agent-loop'])
  const loop = ctx.get<{ model: string; session: unknown }>('agent-loop')
  assert.equal(loop.model, 'deepseek-chat')
  assert.equal(loop.session, session)
  assert.deepEqual(ctx.serviceNames, ['config', 'session', 'agent-loop'])
})

test('resolveOrder 返回依赖在前、无关服务保持输入顺序', () => {
  const order = resolveOrder([
    { name: 'app', deps: ['db', 'logger'], create: () => {} },
    { name: 'db', create: () => {} },
    { name: 'logger', create: () => {} },
  ])
  assert.ok(order.indexOf('db') < order.indexOf('app'))
  assert.ok(order.indexOf('logger') < order.indexOf('app'))
  assert.deepEqual(order, ['db', 'logger', 'app'])
})

test('缺少服务定义抛错', () => {
  const defs: ServiceDef[] = [
    { name: 'app', deps: ['missing'], create: () => {} },
  ]
  assert.throws(() => resolveOrder(defs), /缺少服务定义: missing/)
})

test('循环依赖抛错', () => {
  const defs: ServiceDef[] = [
    { name: 'a', deps: ['b'], create: () => {} },
    { name: 'b', deps: ['a'], create: () => {} },
  ]
  assert.throws(() => resolveOrder(defs), /循环依赖/)
})

test('并行依赖的服务都能拿到', () => {
  const ctx = new Context()
  buildServices(ctx, [
    { name: 'db', create: () => ({ url: 'sqlite://:memory:' }) },
    { name: 'repo', deps: ['db'], create: (deps) => ({ query: () => `db:${(deps.db as { url: string }).url}` }) },
  ])
  assert.equal(ctx.get<{ query: () => string }>('repo').query(), 'db:sqlite://:memory:')
})
