import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Context } from 'cordis'
import * as http from './core/http.ts'
import * as pages from './core/pages.ts'
import * as hub from './core/hub.ts'

const root = dirname(fileURLToPath(import.meta.url))
const publicDir = join(root, '../public')
const port = Number(process.env.PORT ?? 3141)

const ctx = new Context()

ctx.logger.exporter({
  export(message) {
    const time = new Date(message.ts).toISOString().slice(11, 23)
    const args = message.args.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join(' ')
    console.log(`${time} ${message.type.padEnd(5)} ${message.name} ${args}`)
  },
})

ctx.on('http/ready', ({ port }) => {
  ctx.logger('boot').info(`api http://127.0.0.1:${port}  ·  ui http://127.0.0.1:5173`)
})

ctx.plugin(http, { port, publicDir })
ctx.plugin(pages)
ctx.plugin(hub)
