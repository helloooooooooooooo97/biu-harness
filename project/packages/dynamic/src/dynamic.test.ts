import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CordisToolset, DynamicHost } from './index.ts'

// 本文件测动态自指：host 半执行、browser 半审批、工具集。

test('define + run host 半注册服务，stop 后消失', async () => {
  const host = new DynamicHost()
  const id = host.define({ name: 'g', purpose: '打招呼', host: 'ctx.provide("greeting", () => "hi")' })
  assert.equal((await host.run(id)).ok, true)
  assert.equal(host.get<() => string>('greeting')(), 'hi')
  host.stop(id)
  assert.throws(() => host.get('greeting'), /缺少服务/)
})

test('browser 半需要审批，拒绝则不运行', async () => {
  const host = new DynamicHost(async () => false)
  const id = host.define({ name: 'ui', purpose: '加按钮', client: 'slots.register(...)' })
  assert.deepEqual(await host.run(id), { ok: false, reason: '用户拒绝审批' })
})

test('CordisToolset 暴露五个动作', async () => {
  const host = new DynamicHost()
  const tools = new CordisToolset(host)
  const id = await tools.execute('define', { name: 'x', purpose: 'p', host: 'ctx.provide("k", 1)' })
  assert.match(await tools.execute('run', { id }), /^ok$/)
  assert.equal(host.get<number>('k'), 1)
})
