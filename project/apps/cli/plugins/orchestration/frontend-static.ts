/**
 * [orchestration] frontend-static：web 表面 bundle——静态文件 owner（对应 dsh 的
 * frontend-static fallback owner）。提供 frontendStatic 服务：从 dist 目录按名读文件；
 * config.dir 可覆盖目录（默认 apps/cli/web）。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Context, type Plugin } from '@deepseek-ai/cordis'

export interface FrontendStatic {
  dir: string
  read(name: string): string | undefined
}

export const plugin: Plugin<unknown> = {
  name: 'frontend-static',
  provide: 'frontendStatic',
  apply(ctx: Context, config: unknown) {
    const { dir } = (config ?? {}) as { dir?: string }
    const root = dir ?? fileURLToPath(new URL('../../web', import.meta.url))
    ctx.provide('frontendStatic', {
      dir: root,
      read(name: string): string | undefined {
        try {
          return readFileSync(join(root, name), 'utf8')
        } catch {
          return undefined
        }
      },
    } satisfies FrontendStatic)
  },
}
