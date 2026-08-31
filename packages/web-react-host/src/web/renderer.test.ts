import { test } from 'vitest'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { Context } from 'cordis'
import * as slots from '@biu/web-slots'
import * as dock from '@biu/core-dock'
import * as appModules from '@biu/web-app-modules'
import * as snapshot from '@biu/web-snapshot'
import * as sessionView from '@biu/web-session-view'
import * as projectView from '@biu/web-project-view'
import * as shell from '@biu/web-app-shell'
import { renderRoot } from './renderer.tsx'

test('list sorts by order; shell renders activity bar', async () => {
  const ctx = new Context()
  await ctx.plugin(slots)
  await ctx.plugin(dock)
  await ctx.plugin(appModules)
  await ctx.plugin(sessionView)
  await ctx.plugin(projectView)
  await ctx.plugin(snapshot)
  await ctx.plugin(shell)
  const html = renderToStaticMarkup(renderRoot(ctx.slots, ctx.appModules))
  assert.match(html, /Activity bar/)
  assert.match(html, /Agent/)
})
