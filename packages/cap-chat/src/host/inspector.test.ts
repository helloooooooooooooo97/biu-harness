import assert from 'node:assert/strict'
import { test } from 'vitest'
import { buildInspectorTools, isToolActiveForSession, toolSourceOf } from './inspector.ts'

test('toolSourceOf tags minimal / live / plugin / store', () => {
  assert.equal(toolSourceOf('bash'), 'minimal')
  assert.equal(toolSourceOf('str_replace_editor'), 'minimal')
  assert.equal(toolSourceOf('db_action'), 'live')
  assert.equal(toolSourceOf('db_list'), 'live')
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
