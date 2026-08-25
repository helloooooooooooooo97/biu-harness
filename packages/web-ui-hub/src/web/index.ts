import type { Context, Fiber, Plugin } from 'cordis'
import { uiPackageLoaders } from 'virtual:cordis-ui-loaders'

export const name = 'ui-hub'
export const inject = ['slots', 'snapshot']

export function apply(ctx: Context) {
  const forks = new Map<string, Fiber>()
  let pending = false
  let running = false

  async function resolvePlugin(_id: string, web?: string): Promise<Plugin | undefined> {
    if (!web) return undefined
    const loader = uiPackageLoaders[web]
    if (loader) return loader()
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
