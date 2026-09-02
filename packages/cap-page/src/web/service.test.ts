import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import { PageEditorService, getPageEditor } from './service.ts'
import { filterSlashItems } from './slash.ts'

test('replaceHeading is scoped to the calling plugin fiber', async () => {
  const ctx = new Context()
  new PageEditorService(ctx)
  assert.ok(getPageEditor())
  const fiber = ctx.plugin({
    name: 'theme',
    inject: ['pageEditor'],
    apply(inner) {
      inner.pageEditor.replaceHeading(1, { label: 'H1' })
    },
  })
  await fiber
  assert.equal(ctx.pageEditor.headingView(1)?.label, 'H1')
  await fiber.dispose()
  assert.equal(ctx.pageEditor.headingView(1), undefined)
})

test('slash extras override built-in labels and dispose', async () => {
  const ctx = new Context()
  new PageEditorService(ctx)
  const fiber = ctx.plugin({
    name: 'slash-theme',
    inject: ['pageEditor'],
    apply(inner) {
      inner.pageEditor.slash({ id: 'h1', label: '封面标题', hint: '插件', aliases: ['cover'] })
    },
  })
  await fiber
  const hit = filterSlashItems('cover').find((item) => item.id === 'h1')
  assert.equal(hit?.label, '封面标题')
  await fiber.dispose()
  assert.equal(filterSlashItems('cover').some((item) => item.id === 'h1'), false)
})
