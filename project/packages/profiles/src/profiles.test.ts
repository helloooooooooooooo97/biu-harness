import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyPatch, composeProfile, type BundleManifest, type ProfileManifest } from './index.ts'

// 本文件测分层：覆盖、insert、缺 bundle、缺目标。

const bundles = new Map<string, BundleManifest>([
  ['base', { name: 'base', patch: [{ id: 'tools', name: 'tools', config: { limit: 5 } }] }],
])

test('profile patch 整行覆盖 bundle 配置', () => {
  const profile: ProfileManifest = { name: 'web', bundles: ['base'], patch: [{ id: 'tools', replace: { config: { limit: 10 } } }] }
  const entries = composeProfile(profile, bundles)
  assert.equal((entries[0].config as Record<string, unknown>).limit, 10)
})

test('insert 追加新行', () => {
  const entries = applyPatch([{ id: 'a', name: 'a' }], [{ insert: [{ id: 'b', name: 'b' }] }])
  assert.deepEqual(entries.map((e) => e.id), ['a', 'b'])
})

test('未知 bundle 与缺目标都抛错', () => {
  assert.throws(() => composeProfile({ name: 'x', bundles: ['ghost'] }, bundles), /未知 bundle/)
  assert.throws(() => applyPatch([{ id: 'a', name: 'a' }], [{ id: 'nope', replace: { enabled: false } }]), /目标不存在/)
})
