import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evalJs, expandIncludes, parseEntries } from './config.ts'

// 本文件测配置解析：① 校验；② js 表达式；③ include 展开。

test('解析并校验 entries', () => {
  const entries = parseEntries('{"entries":[{"id":"a","name":"tools"},{"id":"b","name":"logger","enabled":false}]}')
  assert.equal(entries.length, 2)
  assert.equal(entries[1].enabled, false)
  assert.throws(() => parseEntries('{"entries":[{"id":"a"}]}'), /必须含 id 与 name/)
})

test('evalJs 求值 js: 表达式，其他值原样返回', () => {
  assert.equal(evalJs('js: ctx.n + 1', { n: 41 }), 42)
  assert.equal(evalJs('plain', {}), 'plain')
  assert.deepEqual(evalJs({ a: 'js: ctx.x' }, { x: 'yes' }), { a: 'yes' })
})

test('expandIncludes 递归展开 include 并求值 config', () => {
  const files = new Map([
    ['base.json', '{"entries":[{"id":"t","name":"tools"}]}'],
  ])
  const entries = expandIncludes(
    parseEntries('{"entries":[{"id":"inc","name":"include","config":{"file":"base.json"}},{"id":"p","name":"prompt","config":{"prefix":"js: ctx.tag"}}]}'),
    files,
    { tag: 'dsh' },
  )
  assert.deepEqual(entries.map((e) => e.name), ['tools', 'prompt'])
  assert.equal((entries[1].config as Record<string, unknown>).prefix, 'dsh')
})
