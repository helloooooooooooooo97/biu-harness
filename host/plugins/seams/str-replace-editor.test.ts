import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import '../../types.ts'
import * as tools from '../registry/tools.ts'
import * as fs from './fs.ts'

async function setup() {
  const ctx = new Context()
  await ctx.plugin(tools)
  const root = await mkdtemp(join(tmpdir(), 'cordis-editor-'))
  await ctx.plugin(fs, { root })
  return { ctx, root }
}

test('str_replace_editor view/create/str_replace/insert', async () => {
  const { ctx, root } = await setup()
  await mkdir(join(root, 'src'), { recursive: true })
  await writeFile(join(root, 'src', 'a.ts'), 'const x = 1\nconst y = 2\n', 'utf8')

  const viewed = String(
    await ctx.tools.invoke('str_replace_editor', { command: 'view', path: 'src/a.ts', view_range: [1, 1] }),
  )
  assert.match(viewed, /1\tconst x = 1/)

  const tree = String(await ctx.tools.invoke('str_replace_editor', { command: 'view', path: '.' }))
  assert.match(tree, /src\//)

  await ctx.tools.invoke('str_replace_editor', {
    command: 'create',
    path: 'src/b.ts',
    file_text: 'export const b = 1\n',
  })
  assert.equal(await ctx.fs.read('src/b.ts'), 'export const b = 1\n')
  await assert.rejects(
    () => ctx.tools.invoke('str_replace_editor', { command: 'create', path: 'src/b.ts', file_text: 'x' }),
    /already exists/,
  )

  await ctx.tools.invoke('str_replace_editor', {
    command: 'str_replace',
    path: 'src/a.ts',
    old_str: 'const x = 1',
    new_str: 'const x = 3',
  })
  assert.match(await ctx.fs.read('src/a.ts'), /const x = 3/)

  await ctx.tools.invoke('str_replace_editor', {
    command: 'insert',
    path: 'src/a.ts',
    insert_line: 1,
    new_str: '// inserted',
  })
  const afterInsert = await ctx.fs.read('src/a.ts')
  assert.match(afterInsert, /const x = 3\n\/\/ inserted\nconst y = 2/)
})

test('str_replace_editor rejects absolute path outside workspace', async () => {
  const { ctx } = await setup()
  await assert.rejects(
    () => ctx.tools.invoke('str_replace_editor', { command: 'view', path: '/etc/passwd' }),
    /escapes/,
  )
})
