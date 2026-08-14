import { Service, type Context } from 'cordis'
import '../types.ts'

interface Note {
  id: string
  body: string
  createdAt: number
}

export class NotesService extends Service {
  private notes: Note[] = [
    {
      id: 'seed',
      body: '卸载「便签」插件，这条路由和这块页面会一起消失。',
      createdAt: Date.now(),
    },
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
export const inject = ['http', 'pages']

export function apply(ctx: Context) {
  const notes = new NotesService(ctx)

  ctx.pages.register({
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
