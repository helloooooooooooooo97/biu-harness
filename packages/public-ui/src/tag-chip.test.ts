import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { TAG_TONES, tagTone } from './tag-chip.tsx'

test('tagTone is stable and stays in the shared palette', () => {
  assert.equal(tagTone('dp'), tagTone('dp'))
  assert.equal(TAG_TONES.includes(tagTone('动态规划') as (typeof TAG_TONES)[number]), true)
  assert.notEqual(tagTone('dp'), tagTone('graph'))
})

test('TagChip ships the tinted chip markup', () => {
  const src = readFileSync(resolve(import.meta.dirname, './tag-chip.tsx'), 'utf8')
  assert.match(src, /function TagChip/)
  assert.match(src, /className=\{\`biu-tag/)
  assert.match(src, /color-mix\(in srgb,var\(--biu-tag/)
  assert.match(src, /function TagChips/)
})
