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
  const find = async (id: string) => {
    const row = (await list()).find((item) => item.id === id) ?? null
    if (!row) return null
    return { ...row, readme: await store.readReadme(id) }
  }
  return {
    id: 'plugins',
    path: '/plugins',
    label: '插件',
    view: {
      moduleId: 'plugins',
      route: '/plugins',
      title: '插件',
      inspector: true,
      blurb: '已安装（.plugin）和沙箱（.plugin-dev）同一张表。列表看 db_list /plugins。介绍正文是 README.md：读/写用 db_content /plugins/<id>，不要用 db_update 改 name/blurb 等只读列（合集 facet/tags 仍可 db_update）。records.create=false，新建不要 db_create。下一步：小插件 db_action create（args 带 name + hostJs/webJs，立刻进 .plugin）；多文件先 sandbox 再在 .plugin-dev/<id> 写代码，最后 pack 才进已安装。运行/停止 start/stop（when 看 installed+running）。卸载 uninstall。窗口尺寸看扁平列 shellWidth/shellHeight，没有 listing.shell。',
      order: 30,
      icon: 'puzzle-piece',
    },
    records: { update: false, create: false, delete: true },
    schema: {
      labelField: 'name',
      contentField: 'readme',
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
        tags: { type: 'multi-select', label: '标签', writable: true },
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
        readme: { type: 'file', label: '介绍', writable: true },
      },
    },
    list,
    get: find,
    update: async (id, patch) => {
      const extra = Object.keys(patch).filter((key) => key !== 'readme')
      if (extra.length) throw new Error(`plugin fields not writable: ${extra.join(', ')}`)
      if ('readme' in patch) await store.writeReadme(id, String(patch.readme ?? ''))
      return (await find(id)) ?? (() => {
        throw new Error(`unknown plugin: ${id}`)
      })()
    },
    remove: async (query) => {
      const ids = query.ids ?? []
      for (const id of ids) await store.uninstall(id)
      return ids
    },
    actions: [
      {
        id: 'create',
        label: '直写安装',
        for: 'agent',
        placement: [],
        allowMissing: true,
        description: PLUGIN_CREATE_DESCRIPTION,
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
        for: 'agent',
        placement: [],
        allowMissing: true,
        description: PLUGIN_SANDBOX_DESCRIPTION,
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
        description: '打开已安装插件窗口（无头则只挂 host）。when：installed 且未 running。不要对纯沙箱、未 pack 的行调用。',
        run: async (id) => {
          await store.openPlugin(id)
        },
      },
      {
        id: 'stop',
        label: '停止',
        when: { installed: true, running: true },
        description: '关掉运行中的插件窗口/host。when：installed 且 running。',
        run: async (id) => {
          await store.close(id)
        },
      },
      {
        id: 'pack',
        label: '打包安装',
        when: { sandbox: true },
        description: PLUGIN_PACK_DESCRIPTION,
        parameters: { type: 'object', description: PLUGIN_PACK_DESCRIPTION, properties: {} },
        run: async (id) => store.pack(id),
      },
      {
        id: 'uninstall',
        label: '卸载',
        tone: 'danger',
        confirm: '确定卸载这个插件？已安装的代码会被删掉。',
        when: { installed: true },
        description: '删除 .plugin/<id>/。沙箱 .plugin-dev/<id>/ 还在的话行不会消失，只是 installed 变 false。',
        run: async (id) => {
          await store.uninstall(id)
        },
      },
    ],
  }
}
