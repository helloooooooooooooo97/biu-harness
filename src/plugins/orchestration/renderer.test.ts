import { test } from 'vitest'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { Context } from 'cordis'
import '../../types.ts'
import * as slots from '../registry/slots.ts'
import * as shell from './shell.tsx'
import * as hello from '../contributors/hello.tsx'
import * as about from '../contributors/about.tsx'
import * as nav from '../contributors/nav.tsx'
import { renderRoot } from './renderer.tsx'

test('list sorts by order; single shows first fill', async () => {
  const ctx = new Context()
  await ctx.plugin(slots)
  await ctx.plugin(about)
  await ctx.plugin(hello)
  await ctx.plugin(nav)
  await ctx.plugin(shell)
  const html = renderToStaticMarkup(renderRoot(ctx.slots))
  assert.match(html, /问候/)
  assert.match(html, /说明/)
  assert.ok(html.indexOf('问候') < html.indexOf('说明'))
  assert.match(html, /侧栏/)
})
