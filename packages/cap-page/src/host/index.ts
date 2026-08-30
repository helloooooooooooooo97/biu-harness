import type { Context } from 'cordis'
import type { CollectionSpec } from '@biu/type-file-system'
import { PagesStore, STATUS, type WorkspaceFs } from './store.ts'

export { PAGE_ROOT, PAGE_ASSETS, PagesStore } from './store.ts'

const COLORS = ['red', 'orange', 'yellow', 'green', 'blue'] as const

export function pagesCollection(store: PagesStore): CollectionSpec {
  return {
    id: 'pages',
    path: '/pages',
    label: '页面',
    view: {
      moduleId: 'page',
      route: '/pages',
      title: '页面',
      inspector: true,
      blurb: '页面存成工作区 .page 下的 Markdown；属性写在 YAML frontmatter，图片和附件在 .page/assets。',
      order: 25,
      icon: 'document',
    },
    schema: {
      labelField: 'title',
      contentField: 'notes',
      parentField: 'parentId',
      columns: [
        'title',
        'status',
        'enabled',
        'count',
        'score',
        'tags',
        'aliases',
        'homepage',
        'cover',
        'pack',
        'size',
        'publishedAt',
      ],
      fields: {
        title: { type: 'string', label: '标题', writable: true },
        blurb: { type: 'string', label: '摘要', writable: true },
        count: { type: 'number', label: '计数', writable: true },
        enabled: { type: 'boolean', label: '启用', writable: true },
        status: { type: 'select', label: '状态', writable: true, enum: [...STATUS] },
        tags: { type: 'multi-select', label: '标签', writable: true, enum: [...COLORS, 'prod', 'lab'] },
        aliases: { type: 'string[]', label: '别名', writable: true },
        publishedAt: { type: 'datetime', label: '发布时间', writable: true },
        size: { type: 'bytes', label: '体积', writable: true },
        homepage: { type: 'url', label: '地址', writable: true },
        cover: { type: 'image', label: '封面', writable: true },
        pack: { type: 'attachment', label: '附件', writable: true },
        notes: { type: 'file', label: '正文', writable: true },
        score: { type: 'number', label: '得分', computed: true, sortable: true },
        parentId: { type: 'string', label: '父页面', writable: true },
      },
    },
    records: { update: true, create: true, delete: true },
    list: () => store.list(),
    get: (id) => store.get(id),
    update: (id, patch) => store.update(id, patch),
    create: (fields = {}) => store.create(fields),
    remove: (id) => store.remove(id),
  }
}

function servePageFile(ctx: Context, store: PagesStore) {
  ctx.inject(['http'], (inner) => {
    inner.http.route('GET', '/api/page/file/:name', async (route) => {
      try {
        const { bytes, type } = await store.readAsset(route.params.name ?? '')
        route.res.writeHead(200, { 'content-type': type, 'cache-control': 'private, max-age=60' })
        route.res.end(bytes)
      } catch {
        route.send(404, { error: 'not found' })
      }
    })
  })
}

export const name = 'page'
export const inject = ['database', 'fs']

export function apply(ctx: Context) {
  const store = new PagesStore(ctx.fs as WorkspaceFs)
  ctx.database.register(pagesCollection(store))
  servePageFile(ctx, store)
}

