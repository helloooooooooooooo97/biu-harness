import assert from 'node:assert/strict'
import { test } from 'vitest'
import { buildInspectorTools, isToolActiveForSession, toolSourceOf } from './inspector.ts'

test('toolSourceOf tags minimal / live / plugin / store', () => {
  assert.equal(toolSourceOf('bash'), 'minimal')
  assert.equal(toolSourceOf('str_replace_editor'), 'minimal')
  assert.equal(toolSourceOf('session_list'), 'live')
  assert.equal(toolSourceOf('session_progress'), 'live')
  assert.equal(toolSourceOf('fs_read'), 'plugin')
  assert.equal(toolSourceOf('gomoku_move', 'store'), 'store')
})

test('minimal live session unlocks live tools; pinned extras unlock built-in plugins', () => {
  assert.equal(
    isToolActiveForSession({
      name: 'bash',
      mode: 'minimal',
      sessionType: 'chat',
      pinnedExtras: [],
    }),
    true,
  )
  assert.equal(
    isToolActiveForSession({
      name: 'session_list',
      mode: 'minimal',
      sessionType: 'chat',
      pinnedExtras: [],
    }),
    false,
  )
  assert.equal(
    isToolActiveForSession({
      name: 'session_list',
      mode: 'minimal',
      sessionType: 'live',
      pinnedExtras: [],
    }),
    true,
  )
  assert.equal(
    isToolActiveForSession({
      name: 'fs_read',
      mode: 'minimal',
      sessionType: 'chat',
      pinnedExtras: ['fs_read'],
    }),
    true,
  )
  assert.equal(
    isToolActiveForSession({
      name: 'gomoku_move',
      mode: 'standard',
      sessionType: 'chat',
      pinnedExtras: ['gomoku_move'],
      origin: 'store',
    }),
    false,
  )
  assert.equal(
    isToolActiveForSession({
      name: 'gomoku_move',
      mode: 'create',
      sessionType: 'chat',
      pinnedExtras: [],
      origin: 'store',
    }),
    true,
  )
})

test('buildInspectorTools marks configurable plugin tools in minimal mode', () => {
  const rows = buildInspectorTools(
    [
      { name: 'bash', description: 'shell' },
      { name: 'session_list', description: 'list sessions' },
      { name: 'fs_read', description: 'read file' },
      { name: 'gomoku_move', description: 'play', origin: 'store' },
    ],
    { mode: 'minimal', sessionType: 'live', pinnedExtras: [] },
  )
  assert.equal(rows.find((row) => row.name === 'bash')?.active, true)
  assert.equal(rows.find((row) => row.name === 'bash')?.configurable, false)
  assert.equal(rows.find((row) => row.name === 'session_list')?.active, true)
  assert.equal(rows.find((row) => row.name === 'session_list')?.configurable, false)
  assert.equal(rows.find((row) => row.name === 'fs_read')?.active, false)
  assert.equal(rows.find((row) => row.name === 'fs_read')?.configurable, true)
  assert.equal(rows.find((row) => row.name === 'gomoku_move')?.active, false)
  assert.equal(rows.find((row) => row.name === 'gomoku_move')?.configurable, false)
})
