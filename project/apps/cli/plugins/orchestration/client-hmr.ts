/**
 * [orchestration] client-hmr：web 表面 bundle——始终在线的 client 插件重载链
 * （对应 dsh 的 dsh-client-hmr）。轮询客户端 bundle 文件（mtime + version），
 * 变化即经 SSE 推 reload 事件；浏览器 fiber 收到后先 dispose 再 import 新 bundle。
 * config：{ bundleFile?, versionFile?, intervalMs? }。
 */
import { readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Context, type Plugin } from '@deepseek-ai/cordis'

export interface ClientHmr {
  version(): string
  publish(version?: string): void
}

export const plugin: Plugin<unknown> = {
  name: 'client-hmr',
  provide: 'clientHmr',
  inject: ['webRuntime'],
  apply(ctx: Context, config: unknown) {
    const { bundleFile, versionFile, intervalMs = 500 } = (config ?? {}) as {
      bundleFile?: string
      versionFile?: string
      intervalMs?: number
    }
    const web = ctx.get('webRuntime') as { publish(event: object): void }
    const bundle = bundleFile ?? fileURLToPath(new URL('../../web/client.js', import.meta.url))
    const versionPath = versionFile ?? fileURLToPath(new URL('../../web/version.txt', import.meta.url))
    const readVersion = (): string => {
      try {
        return readFileSync(versionPath, 'utf8').trim()
      } catch {
        return 'v1'
      }
    }
    const statSafe = (file: string): number => {
      try {
        return statSync(file).mtimeMs
      } catch {
        return -1
      }
    }
    let lastMtime = statSafe(bundle)
    let lastVersion = readVersion()
    const timer = setInterval(() => {
      const mtime = statSafe(bundle)
      const version = readVersion()
      if (mtime !== lastMtime || version !== lastVersion) {
        lastMtime = mtime
        lastVersion = version
        web.publish({ type: 'reload', version })
      }
    }, intervalMs)
    const hmr: ClientHmr = {
      version: readVersion,
      publish: (version) => web.publish({ type: 'reload', version: version ?? readVersion() }),
    }
    ctx.provide('clientHmr', hmr)
    return () => clearInterval(timer)
  },
}
