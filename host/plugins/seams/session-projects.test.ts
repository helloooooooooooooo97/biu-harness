import { mkdtemp, readFile } from 'node:fs/promises'
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
import { runWithSession } from '../core/session-scope.ts'

async function setup() {
  const ctx = new Context()
  const projectBase = await mkdtemp(join(tmpdir(), 'cordis-proj-'))
  const workspace = await mkdtemp(join(tmpdir(), 'cordis-ws-'))
  const storeDir = await mkdtemp(join(tmpdir(), 'cordis-store-'))
  await ctx.plugin(tools)
  await ctx.plugin(sessionStore, { driver: 'json', dir: storeDir })
  await ctx.plugin(sessions)
  await ctx.plugin(systemPrompt)
  await ctx.plugin(sessionProjects, { baseDir: projectBase })
  await ctx.plugin(fs, { root: workspace })
  return { ctx, workspace }
}

test('session project sync becomes tool workspace inside runWithSession', async () => {
  const { ctx, workspace } = await setup()
  const record = await ctx.sessions.create()
  await ctx.sessions.setProject(record.id, { name: 'demo' })
  await ctx.sessionProjects.sync(record.id, [
    { path: 'src/hello.txt', content: 'from-project' },
    { path: 'readme.md', content: '# hi' },
  ])

  await runWithSession(record.id, async () => {
    assert.equal(await ctx.fs.read('src/hello.txt'), 'from-project')
    assert.deepEqual((await ctx.fs.list('.')).sort(), ['readme.md', 'src'])
    await ctx.fs.write('src/hello.txt', 'edited')
  })

  const mirrored = await readFile(join(ctx.sessionProjects.rootOf(record.id), 'src/hello.txt'), 'utf8')
  assert.equal(mirrored, 'edited')
  // default workspace untouched
  await assert.rejects(() => readFile(join(workspace, 'src/hello.txt'), 'utf8'))
})

test('bound but unsynced session fails file tools with clear error', async () => {
  const { ctx } = await setup()
  const record = await ctx.sessions.create()
  await ctx.sessions.setProject(record.id, { name: 'demo' })
  await assert.rejects(
    () => runWithSession(record.id, () => ctx.fs.read('a.txt')),
    /尚未同步/,
  )
})
