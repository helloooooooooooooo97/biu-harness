import { test } from 'vitest'
import assert from 'node:assert/strict'
import type { DbRecord } from '@biu/type-file-system'
import { pluginsCollection } from './collection.ts'
import type { PluginStoreService } from './store.ts'

test('pluginsCollection registers /plugins and start/stop/uninstall', async () => {
  const items: DbRecord[] = [{ id: 'demo', name: 'Demo', enabled: false }]
  const calls: string[] = []
  const spec = pluginsCollection({
    list: () => Promise.resolve(items),
    openPlugin(id: string) {
      calls.push(`open:${id}`)
      items[0]!.enabled = true
    },
    close(id: string) {
      calls.push(`close:${id}`)
      items[0]!.enabled = false
    },
    uninstall(id: string) {
      calls.push(`uninstall:${id}`)
    },
  } as PluginStoreService)
  assert.equal(spec.path, '/plugins')
  assert.equal(spec.view?.moduleId, 'plugins')
  assert.deepEqual(
    spec.actions?.map((item) => item.id),
    ['start', 'stop', 'uninstall'],
  )
  await spec.actions!.find((item) => item.id === 'start')!.run('demo', items[0]!)
  assert.deepEqual(calls, ['open:demo'])
  assert.equal(spec.write, undefined)
  assert.deepEqual(spec.schema.columns, ['name', 'blurb', 'running', 'tags'])
  assert.equal(spec.schema.fields.authorUrl?.type, 'url')
})
