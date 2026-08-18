import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CordisToolset } from './cordis-tools.ts'
import { DynamicHost } from './dynamic-host.ts'

// 本文件测动态自指：① host 半执行；② browser 半审批；③ stop/undefine；④ 工具集。

test('define + run host 半注册服务，stop 后消失', async () => {
  const host = new DynamicHost()
  const id = host.define({ name: 'greeter', purpose: '打招呼', host: 'ctx.provide("greeting", () => "hi")' })
  const result = await host.run(id)
  assert.equal(result.ok, true)
  assert.equal((host.get<() => string>('greeting'))(), 'hi')
  host.stop(id)
  assert.throws(() => host.get('greeting'), /缺少服务/)
})

test('browser 半需要审批：拒绝则不运行', async () => {
  const host = new DynamicHost(async () => false)
  const id = host.define({ name: 'ui', purpose: '加按钮', host: 'ctx.provide("x", 1)', client: 'slots.register(...)' })
  const result = await host.run(id)
  assert.deepEqual(result, { ok: false, reason: '用户拒绝审批' })
  assert.equal(host.inspect()[0].running, false)
})

test('undefine 后 inspect 不再包含', async () => {
  const host = new DynamicHost()
  const id = host.define({ name: 'temp', purpose: '临时' })
  host.undefine(id)
  assert.deepEqual(host.inspect(), [])
})

test('CordisToolset 暴露五个动作', async () => {
  const host = new DynamicHost()
  const tools = new CordisToolset(host)
  assert.match(await tools.execute('inspect', {}), /无动态插件/)
  const id = await tools.execute('define', { name: 'x', purpose: 'p', host: 'ctx.provide("k", 1)' })
  assert.match(await tools.execute('run', { id }), /^ok$/)
  assert.equal((host.get<number>('k')), 1)
  assert.match(await tools.execute('stop', { id }), /^stopped$/)
  assert.match(await tools.execute('undefine', { id }), /^undefined$/)
})
