import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Packager, Publisher, validateManifest } from './plugin-package.ts'

// 本文件测发布流程：① 校验；② 打包；③ 版本冲突。

test('validateManifest 缺 name/version 抛错', () => {
  assert.throws(() => validateManifest({ name: '', version: '1.0.0' }), /name 与 version/)
  assert.doesNotThrow(() => validateManifest({ name: 'p', version: '1.0.0', dsh: { bundle: { patch: './cordis.patch.yml' } } }))
})

test('Packager 生成 package.json 与入口', () => {
  const packager = new Packager()
  const files = packager.pack({ name: 'my-plugin', version: '1.0.0' }, new Map([['src/index.ts', '// code']]))
  assert.ok(files.has('package.json'))
  assert.ok(files.has('index.ts'))
  assert.equal(JSON.parse(files.get('package.json')!).name, 'my-plugin')
})

test('Publisher 检测版本冲突', () => {
  const publisher = new Publisher()
  publisher.publish({ name: 'p', version: '1.0.0' })
  assert.doesNotThrow(() => publisher.publish({ name: 'p', version: '1.0.0' }))
  assert.throws(() => publisher.publish({ name: 'p', version: '1.1.0' }), /版本冲突/)
  assert.doesNotThrow(() => publisher.publish({ name: 'other', version: '1.0.0' }))
})
