import { test } from 'vitest'
import assert from 'node:assert/strict'
import { diffStats, lineDiff, parseToolCall, toolSummary } from './tool-format.ts'

test('lineDiff marks removals and additions', () => {
  const lines = lineDiff('a\nb\nc', 'a\nx\nc')
  assert.deepEqual(
    lines.map((line) => [line.type, line.text]),
    [
      ['equal', 'a'],
      ['remove', 'b'],
      ['add', 'x'],
      ['equal', 'c'],
    ],
  )
  assert.deepEqual(diffStats(lines), { added: 1, removed: 1 })
})

test('parseToolCall understands str_replace_editor str_replace', () => {
  const parsed = parseToolCall(
    'str_replace_editor',
    JSON.stringify({
      command: 'str_replace',
      path: 'src/a.ts',
      old_str: 'foo',
      new_str: 'bar',
    }),
  )
  assert.equal(parsed.kind, 'str_replace')
  if (parsed.kind !== 'str_replace') return
  assert.equal(parsed.path, 'src/a.ts')
  assert.equal(parsed.oldStr, 'foo')
  assert.equal(parsed.newStr, 'bar')
  assert.equal(toolSummary(parsed, ''), 'Edited src/a.ts')
})

test('parseToolCall understands bash command', () => {
  const parsed = parseToolCall('bash', JSON.stringify({ command: 'ls -la' }))
  assert.equal(parsed.kind, 'bash')
  if (parsed.kind !== 'bash') return
  assert.equal(parsed.command, 'ls -la')
})

test('parseToolCall create/insert', () => {
  const created = parseToolCall(
    'str_replace_editor',
    JSON.stringify({ command: 'create', path: 'n.ts', file_text: 'hi' }),
  )
  assert.equal(created.kind, 'create')
  const inserted = parseToolCall(
    'str_replace_editor',
    JSON.stringify({ command: 'insert', path: 'n.ts', insert_line: 2, new_str: 'x' }),
  )
  assert.equal(inserted.kind, 'insert')
})
