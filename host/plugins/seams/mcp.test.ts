import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import '../../types.ts'
import * as tools from '../registry/tools.ts'
import * as mcp from './mcp.ts'

test('in-process mcp echo provider', async () => {
  const ctx = new Context()
  await ctx.plugin(tools)
  await ctx.plugin(mcp)
  const listed = await ctx.tools.invoke('mcp_list')
  assert.equal(Array.isArray(listed) && listed.some((item: { name: string }) => item.name === 'mcp_echo'), true)
  const result = (await ctx.tools.invoke('mcp_call', { server: 'echo', name: 'mcp_echo', arguments: { text: 'hi' } })) as { text: string }
  assert.equal(result.text, 'hi')
})
