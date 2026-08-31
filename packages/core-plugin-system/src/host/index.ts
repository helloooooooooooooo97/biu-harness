import type { Context } from 'cordis'
import { pluginsCollection, pluginSandboxesCollection } from './collection.ts'
import { openStore } from './store.ts'

export const name = 'core-plugin-system'
export const inject = ['http', 'hub', 'tools']

export {
  PluginStoreService,
  defaultPluginDir,
  defaultStatePath,
} from './store.ts'
export { pluginsCollection, pluginSandboxesCollection } from './collection.ts'

export async function apply(ctx: Context) {
  const store = await openStore(ctx)
  ctx.inject(['database'], (inner) => {
    inner.database.register(pluginsCollection(store))
    inner.database.register(pluginSandboxesCollection(store))
  })
}
