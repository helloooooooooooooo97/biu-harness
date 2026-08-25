import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import * as tools from '@biu/host-tools'
import * as mcp from './index.ts'

test('in-process mcp echo provider', async () => {
  const ctx = new Context()
  await ctx.plugin(tools)
  await ctx.plugin(mcp)
  const listed = await ctx.tools.invoke('mcp_list')
  assert.equal(Array.isArray(listed) && listed.some((item: { name: string }) => item.name === 'mcp_echo'), true)
  const result = (await ctx.tools.invoke('mcp_call', { server: 'echo', name: 'mcp_echo', arguments: { text: 'hi' } })) as { text: string }
  assert.equal(result.text, 'hi')
})

test('mcp_remove refuses built-in echo and exposes add/remove tools', async () => {
  const ctx = new Context()
  await ctx.plugin(tools)
  await ctx.plugin(mcp)
  assert.equal(ctx.tools.names().includes('mcp_add_stdio'), true)
  assert.equal(ctx.tools.names().includes('mcp_remove'), true)
  await assert.rejects(() => ctx.tools.invoke('mcp_remove', { id: 'echo' }), /cannot remove built-in/)
  assert.deepEqual(ctx.mcp.listServers(), ['echo'])
})
