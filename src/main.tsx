import { Context } from 'cordis'
import './types.ts'
import './style.css'
import { webRuntimeLoaders } from 'virtual:cordis-web-runtime'

const el = document.querySelector<HTMLElement>('#app')
if (!el) throw new Error('#app missing')

const ctx = new Context()

for (const item of webRuntimeLoaders) {
  const mod = await item.load()
  const extra = item.id === 'react-host' ? { el } : item.config ?? undefined
  await ctx.plugin(mod, extra)
}
