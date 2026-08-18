import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyPatch, composeProfile, type BundleManifest, type ProfileManifest } from './layers.ts'

// 本文件测分层组装：① 用户覆盖；② insert；③ 缺 bundle；④ 缺目标。

const bundles = new Map<string, BundleManifest>([
  ['base', {
    name: 'base',
    patch: [
      { id: 'tools', name: 'tools', config: { limit: 5 } },
      { id: 'prompt', name: 'prompt' },
    ],
  }],
  ['web-app', { name: 'web-app', patch: [{ id: 'web', name: 'web' }] }],
])

test('profile patch 按 id 整行覆盖 bundle 配置', () => {
  const profile: ProfileManifest = {
    name: 'web',
    bundles: ['base', 'web-app'],
    patch: [{ id: 'tools', replace: { config: { limit: 10 } } }],
  }
  const entries = composeProfile(profile, bundles)
  const tools = entries.find((e) => e.id === 'tools')!
  assert.equal((tools.config as Record<string, unknown>).limit, 10)
  assert.ok(entries.find((e) => e.id === 'web'))
})

test('patch insert 追加新行', () => {
  const entries = applyPatch([{ id: 'tools', name: 'tools' }], [{ insert: [{ id: 'logger', name: 'logger' }] }])
  assert.deepEqual(entries.map((e) => e.id), ['tools', 'logger'])
})

test('未知 bundle 抛错', () => {
  const profile: ProfileManifest = { name: 'x', bundles: ['ghost'] }
  assert.throws(() => composeProfile(profile, bundles), /未知 bundle: ghost/)
})

test('patch 目标不存在抛错', () => {
  assert.throws(
    () => applyPatch([{ id: 'a', name: 'a' }], [{ id: 'nope', replace: { enabled: false } }]),
    /patch 目标不存在: nope/,
  )
})
