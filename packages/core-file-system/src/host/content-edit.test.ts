import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  asContentText,
  insertText,
  replaceLinesText,
  resolveContentCommand,
  strReplaceText,
  viewContent,
} from './content-edit.ts'

test('view numbers lines and defaults to an 80-line window', () => {
  const text = Array.from({ length: 100 }, (_, i) => `L${i + 1}`).join('\n')
  const viewed = viewContent(text, undefined)
  assert.equal(viewed.start, 1)
  assert.equal(viewed.end, 80)
  assert.equal(viewed.total, 100)
  assert.equal(viewed.truncated, true)
  assert.match(viewed.text, /^  1\tL1/)
  assert.match(viewed.text, /80\tL80$/)
  const ranged = viewContent(text, [90, -1])
  assert.equal(ranged.start, 90)
  assert.equal(ranged.end, 100)
  assert.equal(ranged.truncated, true)
})

test('str_replace requires a unique old_str', () => {
  assert.equal(strReplaceText('aa\nbb\n', 'bb', 'cc'), 'aa\ncc\n')
  assert.throws(() => strReplaceText('aa\naa\n', 'aa', 'x'), /not unique/)
  assert.throws(() => strReplaceText('aa\n', 'zz', 'x'), /not found/)
})

test('insert and replace_lines edit by 1-based line numbers', () => {
  assert.equal(insertText('a\nb\nc', 1, 'x'), 'a\nx\nb\nc')
  assert.equal(insertText('a\nb', 0, 'x'), 'x\na\nb')
  assert.equal(replaceLinesText('a\nb\nc', 2, 3, 'x\ny'), 'a\nx\ny')
  assert.equal(replaceLinesText('a\nb\nc', 2, 2, ''), 'a\nc')
})

test('command defaults to view, or write when value is passed', () => {
  assert.equal(resolveContentCommand({}), 'view')
  assert.equal(resolveContentCommand({ value: 'x' }), 'write')
  assert.equal(resolveContentCommand({ command: 'str_replace' }), 'str_replace')
  assert.equal(asContentText({ a: 1 }), '{\n  "a": 1\n}')
})
