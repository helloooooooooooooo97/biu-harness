import type { Context, Fiber, Plugin } from 'cordis'
import * as React from 'react'
import { uiPackageLoaders } from 'virtual:cordis-ui-loaders'

export const name = 'ui-hub'
export const inject = ['slots', 'snapshot']

/** 商店包的 web 入口是已编译 ESM 的 URL，不在 Vite 虚拟表里。 */
export function isRuntimeWebModule(web: string) {
  return web.startsWith('/') || /^https?:\/\//.test(web)
}

export function apply(ctx: Context) {
  if (typeof globalThis !== 'undefined') {
    const g = globalThis as typeof globalThis & { React?: typeof React }
    g.React = React
  }

  const forks = new Map<string, Fiber>()
  let pending = false
  let running = false

  async function resolvePlugin(_id: string, web?: string): Promise<Plugin | undefined> {
    if (!web) return undefined
    const loader = uiPackageLoaders[web]
    if (loader) return loader()
    if (isRuntimeWebModule(web)) {
      const href = web.startsWith('/') ? new URL(web, window.location.origin).href : web
      const bust = href.includes('?') ? `&v=${Date.now()}` : `?v=${Date.now()}`
      try {
        return await import(/* @vite-ignore */ `${href}${bust}`)
      } catch (error) {
        console.error(`ui-hub: failed to load ${web}`, error)
        return undefined
      }
    }
    return undefined
  }

  async function sync() {
    if (running) {
      pending = true
      return
    }
    running = true
    try {
      const rows = ctx.snapshot.get().plugins
      const enabledRows = rows.filter((plugin) => {
        if (!plugin.web) return false
        if (plugin.enabled) return true
        return plugin.state === 'pending' || plugin.state === 'loading' || plugin.state === 'active'
      })
      const enabledIds = new Set(enabledRows.map((plugin) => plugin.id))

      for (const row of enabledRows) {
        if (forks.has(row.id)) continue
        const loaded = await resolvePlugin(row.id, row.web)
        if (!loaded) continue
        const plugin =
          loaded && typeof loaded === 'object' && 'default' in loaded && (loaded as { default?: Plugin }).default
            ? (loaded as { default: Plugin }).default
            : loaded
        const fiber = ctx.plugin(plugin)
        forks.set(row.id, fiber)
        await fiber
      }

      for (const [id, fiber] of [...forks.entries()]) {
        if (enabledIds.has(id)) continue
        await fiber.dispose()
        forks.delete(id)
      }
    } finally {
      running = false
      if (pending) {
        pending = false
        await sync()
      }
    }
  }

  ctx.snapshot.subscribe(() => {
    void sync()
  })
  return sync()
}
