import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Context } from 'cordis'
import * as http from './plugins/registry/http.ts'
import * as hub from './plugins/registry/hub.ts'

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '../public')
const port = Number(process.env.PORT ?? 3141)

const ctx = new Context()
ctx.logger.exporter({
  export(message) {
    const time = new Date(message.ts).toISOString().slice(11, 23)
    const args = message.args.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join(' ')
    console.log(`${time} ${message.type.padEnd(5)} ${message.name} ${args}`)
  },
})
ctx.on('http/ready', ({ port: ready }) => {
  ctx.logger('boot').info(`api http://127.0.0.1:${ready}  ·  ui http://127.0.0.1:5173`)
})
ctx.plugin(http, { port, publicDir })
ctx.plugin(hub)
