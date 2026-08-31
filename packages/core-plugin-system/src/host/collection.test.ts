import { test } from 'vitest'
import assert from 'node:assert/strict'
import type { DbRecord } from '@biu/type-file-system'
import { pluginSandboxesCollection, pluginsCollection } from './collection.ts'
import type { PluginStoreService } from './store.ts'
import { defaultStoreShell } from '../shell.ts'

test('pluginsCollection registers /plugins with store listing fields', async () => {
  const items: DbRecord[] = [{ id: 'demo', name: 'Demo', enabled: false }]
  const calls: string[] = []
  const spec = pluginsCollection({
    list: () =>
      Promise.resolve([
        {
          id: 'demo',
          name: 'Demo',
          blurb: 'hi',
          tags: ['lab'],
          author: 'ann',
          authorUrl: '',
          enabled: false,
          running: false,
          bytes: 12,
          createdAt: 1,
          updatedAt: 2,
          lastRunAt: null,
          hasHost: true,
          hasWeb: true,
          shell: defaultStoreShell(),
        },
      ]),
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
  const listed = await spec.list()
  assert.equal(listed[0]?.shellWidth, defaultStoreShell().width)
  assert.equal(listed[0]?.hasWeb, true)
  assert.deepEqual(
    spec.actions?.map((item) => item.id),
    ['start', 'stop', 'uninstall'],
  )
  await spec.actions!.find((item) => item.id === 'start')!.run('demo', items[0]!)
  assert.deepEqual(calls, ['open:demo'])
  assert.equal(spec.update, undefined)
  assert.deepEqual(spec.records, { update: false, create: false, delete: false })
  assert.ok(spec.schema.columns?.includes('shellWidth'))
  assert.ok(spec.schema.columns?.includes('enabled'))
  assert.equal(spec.schema.fields.authorUrl?.type, 'url')
  assert.deepEqual(spec.actions?.find((item) => item.id === 'start')?.when, { running: false })
  assert.deepEqual(spec.actions?.find((item) => item.id === 'stop')?.when, { running: true })
})

test('pluginSandboxesCollection registers .plugin-dev drafts', async () => {
  const packed: string[] = []
  const spec = pluginSandboxesCollection({
    listSandboxes: () =>
      Promise.resolve([
        {
          id: 'draft-hello',
          name: 'Hello',
          blurb: '',
          tags: [],
          author: '',
          authorUrl: '',
          hasHost: true,
          hasWeb: false,
          createdAt: 1,
          updatedAt: 2,
        },
      ]),
    pack(id: string) {
      packed.push(id)
    },
  } as PluginStoreService)
  assert.equal(spec.path, '/plugin-sandboxes')
  assert.equal(spec.view?.title, '插件沙箱')
  const listed = await spec.list()
  assert.equal(listed[0]?.id, 'draft-hello')
  await spec.actions!.find((item) => item.id === 'pack')!.run('draft-hello', listed[0]!)
  assert.deepEqual(packed, ['draft-hello'])
})
