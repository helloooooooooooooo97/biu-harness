import { test } from 'vitest'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { Context } from 'cordis'
import '../../types.ts'
import * as slots from '../registry/slots.ts'
import * as snapshot from './snapshot.ts'
import * as sessionView from './session-view.ts'
import * as projectView from './project-view.ts'
import * as shell from '../contributors/shell.tsx'
import * as quotes from '../contributors/quotes.tsx'
import { renderRoot } from './renderer.tsx'

test('list sorts by order; demos show after shell opens', async () => {
  const ctx = new Context()
  await ctx.plugin(slots)
  await ctx.plugin(sessionView)
  await ctx.plugin(projectView)
  await ctx.plugin(snapshot)
  await ctx.plugin(quotes)
  await ctx.plugin(shell)
  const html = renderToStaticMarkup(renderRoot(ctx.slots))
  assert.match(html, /Quotes demo/)
  assert.match(html, /HARNESS/)
})
