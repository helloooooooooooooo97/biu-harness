import { Service, type Context } from 'cordis'
import '../../types.ts'

interface Job {
  id: string
  argv: string[]
  status: 'running' | 'done' | 'cancelled'
  result?: { code: number | null; stdout: string; stderr: string }
  abort: AbortController
}

export class JobsService extends Service {
  private jobs = new Map<string, Job>()

  constructor(ctx: Context) {
    super(ctx, 'jobs')
  }

  async start(argv: string[]) {
    const id = crypto.randomUUID().slice(0, 8)
    const abort = new AbortController()
    const job: Job = { id, argv, status: 'running', abort }
    this.jobs.set(id, job)
    void this.ctx.subprocess.run({ argv, timeoutMs: 60_000 }, abort.signal).then((result) => {
      job.status = 'done'
      job.result = result
    }).catch((error) => {
      job.status = 'done'
      job.result = { code: 1, stdout: '', stderr: String(error) }
    })
    return { id, status: job.status }
  }

  list() {
    return [...this.jobs.values()].map(({ id, argv, status }) => ({ id, argv, status }))
  }

  collect(id: string) {
    const job = this.jobs.get(id)
    if (!job) throw new Error(`unknown job: ${id}`)
    return { id: job.id, status: job.status, result: job.result }
  }

  cancel(id: string) {
    const job = this.jobs.get(id)
    if (!job) throw new Error(`unknown job: ${id}`)
    job.abort.abort()
    job.status = 'cancelled'
    return { id, status: job.status }
  }
}

export const name = 'jobs'
export const inject = ['subprocess', 'tools']

export function apply(ctx: Context) {
  const jobs = new JobsService(ctx)
  ctx.tools.register({
    name: 'job_start',
    description: '后台启动命令，argv 为参数数组',
    parameters: {
      type: 'object',
      properties: { argv: { type: 'array', items: { type: 'string' } } },
      required: ['argv'],
    },
    execute: (args) => jobs.start(Array.isArray(args.argv) ? args.argv.map(String) : ['/bin/sh', '-c', String(args.command ?? 'true')]),
  })
  ctx.tools.register({
    name: 'job_list',
    description: '列出后台任务',
    parameters: { type: 'object', properties: {} },
    execute: () => jobs.list(),
  })
  ctx.tools.register({
    name: 'job_collect',
    description: '读取后台任务结果',
    parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    execute: (args) => jobs.collect(String(args.id)),
  })
  ctx.tools.register({
    name: 'job_cancel',
    description: '取消后台任务',
    parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    execute: (args) => jobs.cancel(String(args.id)),
  })
}
