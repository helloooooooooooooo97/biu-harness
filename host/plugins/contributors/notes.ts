import { Service, type Context } from 'cordis'
import '../../types.ts'

interface Note {
  id: string
  body: string
  createdAt: number
}

export class NotesService extends Service {
  private notes: Note[] = [
    { id: 'seed', body: '卸载「便签」插件，这条路由和这块页面会一起消失。', createdAt: Date.now() },
  ]

  constructor(ctx: Context) {
    super(ctx, 'notes')
  }

  list() {
    return this.notes
  }

  add(body: string) {
    const filtered = this.ctx.waterfall('notes/filter', body, () => body)
    const note = { id: crypto.randomUUID().slice(0, 8), body: filtered, createdAt: Date.now() }
    this.notes.unshift(note)
    return note
  }
}

export const name = 'notes'
export const inject = ['http', 'hub', 'tools']

export function apply(ctx: Context) {
  const notes = new NotesService(ctx)
  ctx.tools.register({
    name: 'notes_list',
    description: '列出当前便签',
    parameters: { type: 'object', properties: {} },
    execute: () => notes.list(),
  })
  ctx.tools.register({
    name: 'notes_add',
    description: '新增一条便签',
    parameters: {
      type: 'object',
      properties: { body: { type: 'string', description: '正文' } },
      required: ['body'],
    },
    execute: (args) => {
      const body = String(args.body ?? '').trim()
      if (!body) throw new Error('empty')
      return notes.add(body)
    },
  })
  ctx.hub.register({
    id: 'notes',
    title: '便签',
    subtitle: '路由随插件卸载自动撤销',
    plugin: 'notes',
    kind: 'notes',
  })
  ctx.http.route('GET', '/api/notes', (route) => {
    route.send(200, { notes: notes.list() })
  })
  ctx.http.route('POST', '/api/notes', async (route) => {
    const payload = (await route.json()) as { body?: string }
    const body = payload?.body?.trim()
    if (!body) return route.send(400, { error: 'empty' })
    route.send(201, { note: notes.add(body) })
  })
}
