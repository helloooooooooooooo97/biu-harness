import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Context } from 'cordis'
import { importConfiguredPackage, readCordisConfig, rootDirFrom } from './cordis-plugins.ts'
import './types.ts'

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '../public')
const port = Number(process.env.PORT ?? 3141)
const host = process.env.HTTP_HOST ?? '127.0.0.1'
const rootDir = rootDirFrom(import.meta.url)

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

async function boot() {
  const config = readCordisConfig(rootDir)
  for (const item of config.host ?? []) {
    if (!item.package || item.enabled === false) continue
    const mod = await importConfiguredPackage(rootDir, item.package)
    const extra = item.id === 'http' ? { port, host, publicDir } : item.config
    await ctx.plugin(mod, extra)
  }
}

boot().catch((error) => {
  console.error('boot failed', error)
  process.exit(1)
})
