import type { Context } from 'cordis'
import type { CollectionSpec, DbRecord } from '@biu/type-file-system'

export const ROW_COUNT = 240

const STATUS = ['draft', 'live', 'archived'] as const
const COLORS = ['red', 'orange', 'yellow', 'green', 'blue'] as const

function seedCover(color: (typeof COLORS)[number]) {
  return `/page-covers/${color}.png`
}

type PageRow = DbRecord & {
  title: string
  blurb: string
  count: number
  enabled: boolean
  status: (typeof STATUS)[number]
  tags: string[]
  aliases: string[]
  publishedAt: number
  size: number
  homepage: string
  cover: string
  pack: { name: string; href: string; bytes: number }
  notes: { kind: string; body: string }
  score: number
  parentId: string | null
}

function seed(index: number, now: number): PageRow {
  const id = `p${String(index).padStart(3, '0')}`
  const status = STATUS[index % STATUS.length]!
  const color = COLORS[index % COLORS.length]!
  const parentId = index > 0 && index % 10 === 3 ? `p${String(index - 3).padStart(3, '0')}` : null
  return {
    id,
    title: `页面 ${index + 1}`,
    blurb: `用于压测 Database 默认表的第 ${index + 1} 条假数据。`,
    count: (index * 7) % 1000,
    enabled: index % 3 !== 0,
    status,
    tags: [color, status === 'live' ? 'prod' : 'lab'],
    aliases: [`page-${index + 1}`, `p${index}`],
    publishedAt: now - index * 3600_000,
    size: 2048 + index * 128,
    homepage: `https://example.com/pages/${id}`,
    cover: seedCover(color),
    pack: {
      name: `${id}.zip`,
      href: `https://example.com/files/${id}.zip`,
      bytes: 48_000 + index * 256,
    },
    notes: { kind: 'doc', body: `这是 ${id} 的正文文件内容。` },
    score: (index % 17) * 3,
    parentId,
    createdAt: now - index * 7200_000,
    updatedAt: now - index * 1800_000,
  }
}

function pagesCollection(now = Date.now()): CollectionSpec {
  const rows = new Map<string, PageRow>()
  for (let i = 0; i < ROW_COUNT; i++) {
    const row = seed(i, now)
    rows.set(row.id, row)
  }

  return {
    id: 'pages',
    path: '/pages',
    label: 'Page',
    view: {
      moduleId: 'page',
      route: '/pages',
      title: 'Page',
      blurb: '每种字段类型各登记一列，假数据用来压测 Database 默认界面。',
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
    list: () => [...rows.values()],
    get: (id) => rows.get(id) ?? null,
    write: (id, patch) => {
      const current = rows.get(id)
      if (!current) throw new Error(`unknown page: ${id}`)
      const next: PageRow = {
        ...current,
        ...patch,
        id,
        score: current.score,
        updatedAt: Date.now(),
      }
      rows.set(id, next)
      return next
    },
  }
}

export const name = 'page'
export const inject = ['database']

export function apply(ctx: Context) {
  ctx.database.register(pagesCollection())
}

export { pagesCollection }
