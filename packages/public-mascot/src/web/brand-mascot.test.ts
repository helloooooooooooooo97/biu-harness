import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'

test('brand mascot is the grok blob on a white rounded square', () => {
  const mascot = readFileSync(resolve(import.meta.dirname, './brand-mascot.tsx'), 'utf8')
  const lockup = readFileSync(resolve(import.meta.dirname, '../../../../public/brand-lockup.svg'), 'utf8')
  const geo = readFileSync(resolve(import.meta.dirname, '../../../../public/grok-bot/geometry-data.js'), 'utf8')
  const blob = geo.match(/"blobPath":"([^"]+)"/)?.[1]
  assert.ok(blob)
  assert.match(mascot, /fill="#fff"/)
  assert.match(mascot, /rx="8"/)
  assert.match(mascot, new RegExp(blob.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(mascot, /fill="#000"/)
  assert.match(mascot, /SidebarBrandLockup/)
  assert.match(lockup, /rx="8"/)
  assert.match(lockup, /fill="#ffffff"/)
  assert.match(lockup, new RegExp(blob.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  const favicon = readFileSync(resolve(import.meta.dirname, '../../../../public/favicon.svg'), 'utf8')
  assert.match(favicon, /rx="8"/)
  assert.match(favicon, /fill="#ffffff"/)
  assert.match(favicon, new RegExp(blob.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.doesNotMatch(favicon, /M0.27 170.27/)
  assert.doesNotMatch(mascot, /#0066B0/)
  assert.doesNotMatch(lockup, /linearGradient/)
})
