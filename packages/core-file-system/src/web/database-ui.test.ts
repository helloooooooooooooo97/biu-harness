import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import { DatabaseUiService, normalizeCollectionPath } from './database-ui.ts'

test('normalizeCollectionPath strips trailing slash', () => {
  assert.equal(normalizeCollectionPath('/plugins/'), '/plugins')
  assert.equal(normalizeCollectionPath('plugins'), '/plugins')
})

test('decorate merges cells; later layer wins; dispose restores', () => {
  const ctx = new Context()
  const ui = new DatabaseUiService(ctx)
  const NameA = () => null
  const NameB = () => null
  const Tags = () => null
  const first = ui.decorate('/plugins', { cells: { name: NameA, tags: Tags } })
  const second = ui.decorate('/plugins', { cells: { name: NameB } })
  assert.equal(ui.chrome('/plugins').cells?.name, NameB)
  assert.equal(ui.chrome('/plugins').cells?.tags, Tags)
  first.dispose()
  assert.equal(ui.chrome('/plugins').cells?.name, NameB)
  assert.equal(ui.chrome('/plugins').cells?.tags, undefined)
  second.dispose()
  assert.equal(ui.chrome('/plugins').cells?.name, undefined)
})
