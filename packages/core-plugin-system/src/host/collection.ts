import type { CollectionSpec, DbRecord } from '@biu/type-file-system'
import { recordBuiltinValues, REQUIRED_RECORD_FIELDS } from '@biu/type-file-system'
import {
  createArgs,
  PLUGIN_CREATE_DESCRIPTION,
  PLUGIN_CREATE_PROPERTIES,
  PLUGIN_PACK_DESCRIPTION,
  PLUGIN_SANDBOX_DESCRIPTION,
  PLUGIN_SANDBOX_PROPERTIES,
} from './plugin-create.ts'
import type { PluginStoreService, StoreListing } from './store.ts'

type SandboxListing = Awaited<ReturnType<PluginStoreService['listSandboxes']>>[number]

function omitEmpty(row: DbRecord): DbRecord {
  const next: DbRecord = { id: row.id }
  for (const [key, value] of Object.entries(row)) {
    if (key === 'id') continue
    if (value == null || value === '' || value === false) continue
    if (Array.isArray(value) && value.length === 0) continue
    next[key] = value
  }
  return { ...next, ...recordBuiltinValues(row) }
}

function asInstalledRecord(row: StoreListing): DbRecord {
  const shell = row.shell
  return omitEmpty({
    id: row.id,
    name: row.name,
    title: row.name,
    blurb: row.blurb,
    tags: row.tags,
    author: row.author,
    authorUrl: row.authorUrl,
    installed: true,
    enabled: row.enabled,
    running: row.running,
    bytes: row.bytes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastRunAt: row.lastRunAt,
    hasHost: row.hasHost,
    hasWeb: row.hasWeb,
    headless: row.headless === true,
    ...(row.headless || !shell
      ? {}
      : {
          shellWidth: shell.width,
          shellHeight: shell.height,
          shellMinWidth: shell.minWidth,
          shellMinHeight: shell.minHeight,
          shellResizable: shell.resizable,
        }),
  })
}

function asSandboxRecord(row: SandboxListing): DbRecord {
  return omitEmpty({
    id: row.id,
    name: row.name,
    title: row.name,
    blurb: row.blurb,
    tags: row.tags,
    author: row.author,
    authorUrl: row.authorUrl,
    sandbox: true,
    hasHost: row.hasHost,
    hasWeb: row.hasWeb,
    headless: row.headless === true,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  })
}

function mergeLifecycle(installed: StoreListing | undefined, sandbox: SandboxListing | undefined): DbRecord {
  if (installed && sandbox) {
    return omitEmpty({
      ...asInstalledRecord(installed),
      sandbox: true,
      updatedAt: Math.max(installed.updatedAt, sandbox.updatedAt),
    })
  }
  if (installed) return asInstalledRecord(installed)
  if (sandbox) return asSandboxRecord(sandbox)
  throw new Error('empty plugin row')
}

export function pluginsCollection(store: PluginStoreService): CollectionSpec {
  const list = async () => {
    const [installed, sandboxes] = await Promise.all([store.list(), store.listSandboxes()])
    const ids = new Set([...installed.map((row) => row.id), ...sandboxes.map((row) => row.id)])
    const byInstalled = new Map(installed.map((row) => [row.id, row]))
    const bySandbox = new Map(sandboxes.map((row) => [row.id, row]))
    return [...ids]
      .sort()
      .map((id) => mergeLifecycle(byInstalled.get(id), bySandbox.get(id)))
  }
  const find = async (id: string) => (await list()).find((row) => row.id === id) ?? null
  return {
    id: 'plugins',
    path: '/plugins',
    label: '插件',
    view: {
      moduleId: 'plugins',
      route: '/plugins',
      title: '插件',
      inspector: true,
      blurb: '.plugin 已安装与 .plugin-dev 沙箱同一张表。新建用 db_action create/sandbox，打包用 pack。窗口尺寸来自扁平列 shellWidth/shellHeight，不是 listing.shell。',
      order: 30,
      icon: 'puzzle-piece',
    },
    records: { update: false, create: false, delete: true },
    schema: {
      labelField: 'name',
      columns: [
        'name',
        'blurb',
        'installed',
        'sandbox',
        'running',
        'enabled',
        'tags',
        'author',
        'bytes',
        'shellWidth',
        'shellHeight',
        'hasHost',
        'hasWeb',
        'headless',
      ],
      fields: {
        ...REQUIRED_RECORD_FIELDS,
        name: { type: 'string', label: '名称' },
        blurb: { type: 'string', label: '简介' },
        installed: { type: 'boolean', label: '已安装' },
        sandbox: { type: 'boolean', label: '沙箱' },
        enabled: { type: 'boolean', label: '已打开' },
        running: { type: 'boolean', label: '运行中' },
        tags: { type: 'multi-select', label: '标签' },
        bytes: { type: 'number', label: '大小' },
        createdAt: { type: 'datetime', label: '创建时间' },
        updatedAt: { type: 'datetime', label: '更新时间' },
        lastRunAt: { type: 'datetime', label: '上次运行' },
        hasHost: { type: 'boolean', label: 'Host' },
        hasWeb: { type: 'boolean', label: 'Web' },
        headless: { type: 'boolean', label: '无头' },
        author: { type: 'string', label: '作者' },
        authorUrl: { type: 'url', label: '作者链接' },
        shellWidth: { type: 'number', label: '窗口宽' },
        shellHeight: { type: 'number', label: '窗口高' },
        shellMinWidth: { type: 'number', label: '最小宽' },
        shellMinHeight: { type: 'number', label: '最小高' },
        shellResizable: { type: 'boolean', label: '可缩放' },
      },
    },
    list,
    get: find,
    remove: async (query) => {
      const ids = query.ids ?? []
      for (const id of ids) await store.uninstall(id)
      return ids
    },
    actions: [
      {
        id: 'create',
        label: '直写安装',
        placement: [],
        allowMissing: true,
        parameters: {
          type: 'object',
          description: PLUGIN_CREATE_DESCRIPTION,
          properties: PLUGIN_CREATE_PROPERTIES,
          required: ['name'],
        },
        run: async (id, _record, args = {}) => store.create(createArgs({ ...args, id })),
      },
      {
        id: 'sandbox',
        label: '开沙箱',
        placement: [],
        allowMissing: true,
        parameters: {
          type: 'object',
          description: PLUGIN_SANDBOX_DESCRIPTION,
          properties: PLUGIN_SANDBOX_PROPERTIES,
          required: ['name'],
        },
        run: async (id, _record, args = {}) => store.initSandbox(createArgs({ ...args, id })),
      },
      {
        id: 'start',
        label: '运行',
        when: { installed: true, running: false },
        run: async (id) => {
          await store.openPlugin(id)
        },
      },
      {
        id: 'stop',
        label: '停止',
        when: { installed: true, running: true },
        run: async (id) => {
          await store.close(id)
        },
      },
      {
        id: 'pack',
        label: '打包安装',
        when: { sandbox: true },
        parameters: { type: 'object', description: PLUGIN_PACK_DESCRIPTION, properties: {} },
        run: async (id) => store.pack(id),
      },
      {
        id: 'uninstall',
        label: '卸载',
        tone: 'danger',
        confirm: '确定卸载这个插件？已安装的代码会被删掉。',
        when: { installed: true },
        run: async (id) => {
          await store.uninstall(id)
        },
      },
    ],
  }
}
