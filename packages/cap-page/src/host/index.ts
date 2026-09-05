import type { Context } from 'cordis'
import type { CollectionSpec } from '@biu/type-file-system'
import { REQUIRED_RECORD_FIELDS } from '@biu/type-file-system'
import { PagesStore, STATUS, type WorkspaceFs } from './store.ts'

export { PAGE_ROOT, PAGE_ASSETS, ASSET_GC_GRACE_MS, collectPageAssetNames, PagesStore } from './store.ts'

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
      blurb: '页面存在工作区 .page/pages.sqlite。列表 db_list /pages 走 SQLite，不扫全部 Markdown；正文 notes 用 db_content / db_update。图片和附件仍在 .page/assets。树用 parentId。新建 db_create，删除 db_delete。本表没有 db_action。',
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
        ...REQUIRED_RECORD_FIELDS,
        title: { type: 'string', label: '标题', writable: true },
        blurb: { type: 'string', label: '摘要', writable: true },
        count: { type: 'number', label: '计数', writable: true },
        enabled: { type: 'boolean', label: '启用', writable: true },
        status: { type: 'select', label: '状态', writable: true, enum: [...STATUS] },
        tags: { type: 'multi-select', label: '标签', writable: true },
        aliases: { type: 'string[]', label: '别名', writable: true },
        publishedAt: { type: 'datetime', label: '发布时间', writable: true },
        size: { type: 'number', label: '体积', writable: true },
        homepage: { type: 'url', label: '地址', writable: true },
        cover: { type: 'image', label: '封面', writable: true },
        pack: { type: 'attachment', label: '附件', writable: true },
        notes: { type: 'file', label: '正文', writable: true },
        score: { type: 'number', label: '得分', computed: true, sortable: true },
        parentId: { type: 'string', label: '父级', writable: true },
        dependsOn: { type: 'multi-select', label: '依赖', writable: true },
      },
    },
    records: { update: true, create: true, delete: true },
    list: (query) => store.list(query?.ids),
    get: (id) => store.get(id),
    update: (id, patch) => store.update(id, patch),
    create: async (rows) => {
      const out = []
      for (const fields of rows) out.push(await store.create(fields))
      return out
    },
    remove: async (query) => {
      const ids = query.ids ?? []
      for (const id of ids) await store.remove(id)
      return ids
    },
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
    inner.http.route('PUT', '/api/page/file/:name', async (route) => {
      try {
        const written = await store.writeAsset(route.params.name ?? '', await route.bytes())
        route.send(200, { ok: true, ...written })
      } catch (error) {
        route.send(400, { error: String(error) })
      }
    })
  })
}

export const name = 'page'
export const inject = ['database', 'fs']

export function apply(ctx: Context) {
  // 页面固定存到工作区根（defaultRoot），不随 Session 绑定项目路径漂移，
  // 否则工具调用（绑定项目）与 HTTP 请求（无 Session）会落到不同目录。
  const store = new PagesStore(ctx.fs.workspace as WorkspaceFs)
  ctx.database.register(pagesCollection(store))
  servePageFile(ctx, store)
}

