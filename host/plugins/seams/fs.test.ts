import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import '../../types.ts'
import * as tools from '../registry/tools.ts'
import * as sessionStore from '../storage/session-store.ts'
import * as sessions from '../core/sessions.ts'
import * as systemPrompt from '../core/system-prompt.ts'
import * as sessionProjects from './session-projects.ts'
import * as fs from './fs.ts'

test('fs stays inside workspace', async () => {
  const ctx = new Context()
  await ctx.plugin(tools)
  const storeDir = await mkdtemp(join(tmpdir(), 'cordis-store-'))
  const projectBase = await mkdtemp(join(tmpdir(), 'cordis-proj-'))
  await ctx.plugin(sessionStore, { driver: 'json', dir: storeDir })
  await ctx.plugin(sessions)
  await ctx.plugin(systemPrompt)
  await ctx.plugin(sessionProjects, { baseDir: projectBase })
  const root = await mkdtemp(join(tmpdir(), 'cordis-fs-'))
  await ctx.plugin(fs, { root })
  await ctx.fs.write('a.txt', 'ok')
  assert.equal(await ctx.fs.read('a.txt'), 'ok')
  await assert.rejects(() => ctx.fs.read('../secret'), /escapes/)
})
