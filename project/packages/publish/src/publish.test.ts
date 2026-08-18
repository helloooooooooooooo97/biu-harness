import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Packager, Publisher, validateManifest } from './index.ts'

// 本文件测发布：校验、打包、版本冲突。

test('validateManifest 与 Packager', () => {
  assert.throws(() => validateManifest({ name: '', version: '1.0.0' }), /name 与 version/)
  const files = new Packager().pack({ name: 'p', version: '1.0.0' }, new Map())
  assert.ok(files.has('package.json'))
  assert.ok(files.has('index.ts'))
})

test('Publisher 检测版本冲突', () => {
  const publisher = new Publisher()
  publisher.publish({ name: 'p', version: '1.0.0' })
  assert.throws(() => publisher.publish({ name: 'p', version: '1.1.0' }), /版本冲突/)
})
