import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import '../../types.ts'
import * as http from '../registry/http.ts'
import * as sessionStore from '../storage/session-store.ts'
import * as sessions from '../core/sessions.ts'
import { artifactsDir, readArtifactFile } from '../core/artifacts.ts'

async function freePort() {
  return await new Promise<number>((resolve, reject) => {
    const server = createServer()
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (!addr || typeof addr === 'string') {
        reject(new Error('no port'))
        return
      }
      const port = addr.port
      server.close((error) => (error ? reject(error) : resolve(port)))
    })
    server.on('error', reject)
  })
}

test('GET /api/sessions/:id/artifacts/:name returns image bytes', async () => {
  const base = await mkdtemp(join(tmpdir(), 'cordis-art-http-'))
  const prev = process.cwd()
  process.chdir(base)
  const port = await freePort()
  const publicDir = join(base, 'public')
  await mkdir(publicDir, { recursive: true })
  await writeFile(join(publicDir, 'index.html'), '<html></html>')

  const ctx = new Context()
  const ready = new Promise<void>((resolve) => {
    ctx.on('http/ready', () => resolve())
  })
  await ctx.plugin(http, { port, publicDir })
  await ctx.plugin(sessionStore, { driver: 'memory' })
  await ctx.plugin(sessions)
  await ready

  // 与 chat.ts 同源处理：二进制直出，不走 route.send JSON
  ctx.http.route('GET', '/api/sessions/:id/artifacts/:name', async (route) => {
    const record = await ctx.sessions.get(route.params.id)
    if (!record) return route.send(404, { error: 'unknown session' })
    const file = await readArtifactFile(route.params.id, route.params.name)
    if (!file) return route.send(404, { error: 'unknown artifact' })
    if (route.res.headersSent) return
    route.res.writeHead(200, {
      'content-type': file.mime,
      'cache-control': 'private, max-age=3600',
      'content-length': file.data.byteLength,
    })
    route.res.end(file.data)
  })

  try {
    const record = await ctx.sessions.create()
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    )
    const dir = artifactsDir(record.id)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'smoke.png'), png)

    const res = await fetch(`http://127.0.0.1:${port}/api/sessions/${record.id}/artifacts/smoke.png`)
    const body = Buffer.from(await res.arrayBuffer())
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('content-type'), 'image/png')
    assert.deepEqual(body, png)

    const missing = await fetch(`http://127.0.0.1:${port}/api/sessions/${record.id}/artifacts/nope.png`)
    assert.equal(missing.status, 404)

    const unknownSession = await fetch(`http://127.0.0.1:${port}/api/sessions/no-such/artifacts/smoke.png`)
    assert.equal(unknownSession.status, 404)
  } finally {
    await ctx.parallel('dispose')
    process.chdir(prev)
    await rm(base, { recursive: true, force: true })
  }
})
