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

test('decorate notifies subscribers', () => {
  const ctx = new Context()
  const ui = new DatabaseUiService(ctx)
  let n = 0
  const off = ui.subscribe(() => {
    n += 1
  })
  const handle = ui.decorate('/pages', { cells: {} })
  assert.equal(n, 1)
  handle.dispose()
  assert.equal(n, 2)
  off()
})

test('decorate panes with the same id keep a single pane', () => {
  const ctx = new Context()
  const ui = new DatabaseUiService(ctx)
  const PaneA = () => null
  const PaneB = () => null
  ui.decorate('/tasks', { panes: [{ id: 'script', label: '脚本 A', Pane: PaneA }] })
  ui.decorate('/tasks', { panes: [{ id: 'script', label: '脚本 B', Pane: PaneB }] })
  const panes = ui.chrome('/tasks').panes ?? []
  assert.equal(panes.length, 1)
  assert.equal(panes[0]?.label, '脚本 B')
  assert.equal(panes[0]?.Pane, PaneB)
})
