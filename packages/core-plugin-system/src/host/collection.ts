import type { CollectionSpec, DbRecord } from '@biu/type-file-system'
import type { PluginStoreService, StoreListing } from './store.ts'

function asPluginRecord(row: StoreListing): DbRecord {
  const shell = row.shell
  return {
    id: row.id,
    name: row.name,
    title: row.name,
    blurb: row.blurb,
    tags: row.tags,
    author: row.author,
    authorUrl: row.authorUrl,
    enabled: row.enabled,
    running: row.running,
    bytes: row.bytes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastRunAt: row.lastRunAt,
    hasHost: row.hasHost,
    hasWeb: row.hasWeb,
    shellWidth: shell.width,
    shellHeight: shell.height,
    shellMinWidth: shell.minWidth,
    shellMinHeight: shell.minHeight,
    shellResizable: shell.resizable,
  }
}

export function pluginsCollection(store: PluginStoreService): CollectionSpec {
  const list = async () => (await store.list()).map(asPluginRecord)
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
      blurb: '已安装到 .plugin 的商店插件：运行状态、体积、外壳尺寸和作者。',
      order: 30,
      icon: 'puzzle-piece',
    },
    records: { update: false, create: false, delete: false },
    schema: {
      labelField: 'name',
      columns: [
        'name',
        'blurb',
        'running',
        'enabled',
        'tags',
        'author',
        'bytes',
        'shellWidth',
        'shellHeight',
        'hasHost',
        'hasWeb',
      ],
      fields: {
        name: { type: 'string', label: '名称' },
        blurb: { type: 'string', label: '简介' },
        enabled: { type: 'boolean', label: '已打开' },
        running: { type: 'boolean', label: '运行中' },
        tags: { type: 'multi-select', label: '标签' },
        bytes: { type: 'bytes', label: '大小' },
        createdAt: { type: 'datetime', label: '创建时间' },
        updatedAt: { type: 'datetime', label: '更新时间' },
        lastRunAt: { type: 'datetime', label: '上次运行' },
        hasHost: { type: 'boolean', label: 'Host' },
        hasWeb: { type: 'boolean', label: 'Web' },
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
    actions: [
      {
        id: 'start',
        label: '运行',
        when: { running: false },
        run: async (id) => {
          await store.openPlugin(id)
        },
      },
      {
        id: 'stop',
        label: '停止',
        when: { running: true },
        run: async (id) => {
          await store.close(id)
        },
      },
      {
        id: 'uninstall',
        label: '卸载',
        tone: 'danger',
        confirm: '确定卸载这个插件？代码会被删掉。',
        run: async (id) => {
          await store.uninstall(id)
        },
      },
    ],
  }
}

export function pluginSandboxesCollection(store: PluginStoreService): CollectionSpec {
  const list = async () =>
    (await store.listSandboxes()).map((row) => ({
      id: row.id,
      name: row.name,
      title: row.name,
      blurb: row.blurb,
      tags: row.tags,
      author: row.author,
      authorUrl: row.authorUrl,
      hasHost: row.hasHost,
      hasWeb: row.hasWeb,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }))
  const find = async (id: string) => (await list()).find((row) => row.id === id) ?? null
  return {
    id: 'plugin-sandboxes',
    path: '/plugin-sandboxes',
    label: '插件沙箱',
    view: {
      moduleId: 'plugin-sandboxes',
      route: '/plugin-sandboxes',
      title: '插件沙箱',
      inspector: true,
      blurb: '.plugin-dev 里的开发沙箱：源码还没打包进已安装插件。',
      order: 31,
      icon: 'puzzle-piece',
    },
    records: { update: false, create: false, delete: false },
    schema: {
      labelField: 'name',
      columns: ['name', 'blurb', 'tags', 'author', 'hasHost', 'hasWeb', 'updatedAt'],
      fields: {
        name: { type: 'string', label: '名称' },
        blurb: { type: 'string', label: '简介' },
        tags: { type: 'multi-select', label: '标签' },
        author: { type: 'string', label: '作者' },
        authorUrl: { type: 'url', label: '作者链接' },
        hasHost: { type: 'boolean', label: 'Host' },
        hasWeb: { type: 'boolean', label: 'Web' },
        createdAt: { type: 'datetime', label: '创建时间' },
        updatedAt: { type: 'datetime', label: '更新时间' },
      },
    },
    list,
    get: find,
    actions: [
      {
        id: 'pack',
        label: '打包安装',
        run: async (id) => {
          await store.pack(id)
        },
      },
    ],
  }
}
