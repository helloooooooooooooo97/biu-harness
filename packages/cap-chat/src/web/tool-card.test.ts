import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

test('bash command and output use the same panel tokens as json args', () => {
  const source = readFileSync(resolve(import.meta.dirname, './tool-card.tsx'), 'utf8')
  assert.doesNotMatch(source, /#1e1f24|#e8eaed|#8ab4f8/)
  assert.match(source, /parsed\.kind === 'bash'[\s\S]*bg-\(--dsw-tool\)[\s\S]*text-\(--dsw-label-2\)/)
  assert.match(source, /detail\.kind === 'bash'[\s\S]*bg-\(--dsw-tool\)/)
})
