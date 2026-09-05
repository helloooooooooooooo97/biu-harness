import assert from 'node:assert/strict'
import { test } from 'vitest'
import { buildInspectorTools, isToolActiveForSession, toolSourceOf } from './inspector.ts'

test('toolSourceOf tags minimal / db / plugin / store', () => {
  assert.equal(toolSourceOf('bash'), 'minimal')
  assert.equal(toolSourceOf('str_replace_editor'), 'minimal')
  assert.equal(toolSourceOf('db_action'), 'db')
  assert.equal(toolSourceOf('db_list'), 'db')
  assert.equal(toolSourceOf('fs_read'), 'plugin')
  assert.equal(toolSourceOf('gomoku_move', 'store'), 'store')
})

test('minimal unlocks extras; standard includes store tools', () => {
  assert.equal(
    isToolActiveForSession({
      name: 'bash',
      mode: 'minimal',
      pinnedExtras: [],
    }),
    true,
  )
  assert.equal(
    isToolActiveForSession({
      name: 'db_action',
      mode: 'minimal',
      pinnedExtras: [],
    }),
    false,
  )
  assert.equal(
    isToolActiveForSession({
      name: 'db_action',
      mode: 'minimal',
      pinnedExtras: ['db_action'],
    }),
    true,
  )
  assert.equal(
    isToolActiveForSession({
      name: 'fs_read',
      mode: 'minimal',
      pinnedExtras: ['fs_read'],
    }),
    true,
  )
  assert.equal(
    isToolActiveForSession({
      name: 'gomoku_move',
      mode: 'standard',
      pinnedExtras: [],
      origin: 'store',
    }),
    true,
  )
  assert.equal(
    isToolActiveForSession({
      name: 'gomoku_move',
      mode: 'minimal',
      pinnedExtras: [],
      origin: 'store',
    }),
    false,
  )
  assert.equal(
    isToolActiveForSession({
      name: 'db_list',
      mode: 'file',
      pinnedExtras: [],
    }),
    true,
  )
  assert.equal(
    isToolActiveForSession({
      name: 'bash',
      mode: 'file',
      pinnedExtras: ['bash'],
    }),
    false,
  )
  assert.equal(
    isToolActiveForSession({
      name: 'fs_read',
      mode: 'file',
      pinnedExtras: ['fs_read'],
    }),
    false,
  )
})

test('buildInspectorTools marks configurable plugin tools in minimal mode', () => {
  const rows = buildInspectorTools(
    [
      { name: 'bash', description: 'shell' },
      { name: 'db_action', description: 'run collection action' },
      { name: 'fs_read', description: 'read file' },
      { name: 'gomoku_move', description: 'play', origin: 'store' },
    ],
    { mode: 'minimal', pinnedExtras: [] },
  )
  assert.equal(rows.find((row) => row.name === 'bash')?.active, true)
  assert.equal(rows.find((row) => row.name === 'bash')?.configurable, false)
  assert.equal(rows.find((row) => row.name === 'db_action')?.active, false)
  assert.equal(rows.find((row) => row.name === 'fs_read')?.active, false)
  assert.equal(rows.find((row) => row.name === 'fs_read')?.configurable, true)
  assert.equal(rows.find((row) => row.name === 'gomoku_move')?.active, false)
  assert.equal(rows.find((row) => row.name === 'gomoku_move')?.configurable, false)
})

test('inspector tool sources do not use a live type', async () => {
  const { readFileSync } = await import('node:fs')
  const { resolve } = await import('node:path')
  const src = readFileSync(resolve(import.meta.dirname, './inspector.ts'), 'utf8')
  const dialog = readFileSync(resolve(import.meta.dirname, '../../../web-session-view/src/web/session-config-dialog.tsx'), 'utf8')
  const approvals = readFileSync(resolve(import.meta.dirname, '../web/approvals.tsx'), 'utf8')
  assert.doesNotMatch(src, /Live 调度/)
  assert.doesNotMatch(src, /id: 'live'/)
  assert.match(src, /id: 'db'/)
  assert.doesNotMatch(dialog, /'live'/)
  assert.match(approvals, /id: 'file'/)
  assert.match(approvals, /id: 'minimal'/)
  assert.match(approvals, /id: 'standard'/)
})
