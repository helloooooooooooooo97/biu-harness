import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

test('tool panels match the step bar: sidebar fill, no border', () => {
  const source = readFileSync(resolve(import.meta.dirname, './tool-card.tsx'), 'utf8')
  const css = readFileSync(resolve(import.meta.dirname, '../../../../web/style.css'), 'utf8')
  assert.doesNotMatch(source, /#1e1f24|#e8eaed|#8ab4f8/)
  assert.match(source, /parsed\.kind === 'bash'[\s\S]*bg-\(--dsw-sidebar\)[\s\S]*text-\(--dsw-label-2\)/)
  assert.match(source, /detail\.kind === 'bash'[\s\S]*bg-\(--dsw-sidebar\)/)
  assert.match(source, /prettyJsonString\(rawArguments\)[\s\S]*bg-\(--dsw-sidebar\)|bg-\(--dsw-sidebar\)[\s\S]*prettyJsonString/)
  assert.equal((source.match(/border border-\(--dsw-border\)/g) || []).length, 0)
  assert.match(css, /\.chat-step-bar\s*\{[^}]*background:\s*var\(--dsw-sidebar\)/s)
  assert.match(
    css,
    /\.tool-call-head:hover::before,\s*\.tool-call-head\.is-open::before\s*\{[^}]*background:\s*var\(--dsw-sidebar\)/s,
  )
  assert.doesNotMatch(source, /CheckCircleIcon|XCircleIcon|tool-call-status/)
  assert.match(source, /tool-call-chevron \$\{status\.className\}/)
  assert.match(css, /\.tool-call-chevron\.is-ok\s*\{[^}]*color:\s*#448361/s)
  assert.match(css, /\.tool-call-chevron\.is-fail\s*\{[^}]*color:\s*#c4554d/s)
  assert.match(css, /\.tool-call-inspect\s*\{[^}]*opacity:\s*0/s)
  assert.match(css, /\.tool-call-head:hover \.tool-call-inspect/s)
})
