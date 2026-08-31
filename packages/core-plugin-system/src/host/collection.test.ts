import { test } from 'vitest'
import assert from 'node:assert/strict'
import type { DbRecord } from '@biu/type-file-system'
import { pluginsCollection } from './collection.ts'
import type { PluginStoreService } from './store.ts'
import { defaultStoreShell } from '../shell.ts'

test('pluginsCollection lists installed plugins and sandboxes in one table', async () => {
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
    openPlugin(id: string) {
      calls.push(`open:${id}`)
      items[0]!.enabled = true
    },
    close(id: string) {
      calls.push(`close:${id}`)
      items[0]!.enabled = false
    },
    pack(id: string) {
      calls.push(`pack:${id}`)
    },
    uninstall(id: string) {
      calls.push(`uninstall:${id}`)
    },
  } as PluginStoreService)
  assert.equal(spec.path, '/plugins')
  assert.equal(spec.view?.moduleId, 'plugins')
  const listed = await spec.list()
  const demo = listed.find((row) => row.id === 'demo')
  const draft = listed.find((row) => row.id === 'draft-hello')
  assert.equal(demo?.installed, true)
  assert.equal(demo?.sandbox, undefined)
  assert.equal(demo?.shellWidth, defaultStoreShell().width)
  assert.equal(demo?.hasWeb, true)
  assert.equal(draft?.sandbox, true)
  assert.equal(draft?.installed, undefined)
  assert.equal(draft?.running, undefined)
  assert.equal(draft?.bytes, undefined)
  assert.equal(draft?.shellWidth, undefined)
  assert.deepEqual(
    spec.actions?.map((item) => item.id),
    ['start', 'stop', 'pack', 'uninstall'],
  )
  await spec.actions!.find((item) => item.id === 'start')!.run('demo', demo!)
  await spec.actions!.find((item) => item.id === 'pack')!.run('draft-hello', draft!)
  assert.deepEqual(calls, ['open:demo', 'pack:draft-hello'])
  assert.equal(spec.update, undefined)
  assert.deepEqual(spec.records, { update: false, create: false, delete: true })
  assert.equal(typeof spec.remove, 'function')
  assert.ok(spec.schema.columns?.includes('sandbox'))
  assert.ok(spec.schema.columns?.includes('installed'))
  assert.deepEqual(spec.actions?.find((item) => item.id === 'start')?.when, { installed: true, running: false })
  assert.deepEqual(spec.actions?.find((item) => item.id === 'pack')?.when, { sandbox: true })
  assert.deepEqual(spec.actions?.find((item) => item.id === 'uninstall')?.when, { installed: true })
})

test('same id with sandbox and install merges into one row', async () => {
  const spec = pluginsCollection({
    list: () =>
      Promise.resolve([
        {
          id: 'echo',
          name: 'Echo',
          blurb: 'packed',
          tags: [],
          author: '',
          authorUrl: '',
          enabled: true,
          running: true,
          bytes: 40,
          createdAt: 1,
          updatedAt: 4,
          lastRunAt: 3,
          hasHost: true,
          hasWeb: false,
          shell: defaultStoreShell(),
        },
      ]),
    listSandboxes: () =>
      Promise.resolve([
        {
          id: 'echo',
          name: 'Echo draft',
          blurb: 'src',
          tags: [],
          author: '',
          authorUrl: '',
          hasHost: true,
          hasWeb: false,
          createdAt: 1,
          updatedAt: 9,
        },
      ]),
    openPlugin() {},
    close() {},
    pack() {},
    uninstall() {},
  } as PluginStoreService)
  const listed = await spec.list()
  assert.equal(listed.length, 1)
  assert.equal(listed[0]?.id, 'echo')
  assert.equal(listed[0]?.installed, true)
  assert.equal(listed[0]?.sandbox, true)
  assert.equal(listed[0]?.running, true)
  assert.equal(listed[0]?.updatedAt, 9)
})
