import { test } from 'vitest'
import assert from 'node:assert/strict'
import { act } from 'react'
import { Context } from 'cordis'
import '../../types.ts'
import * as slots from '../registry/slots.ts'
import * as snapshot from '../infrastructure/snapshot.ts'
import * as reactHost from './react-host.ts'
import * as shell from './shell.tsx'

test('paints shell into el', async () => {
  const el = document.createElement('div')
  const ctx = new Context()
  await ctx.plugin(slots)
  await ctx.plugin(snapshot)
  await act(async () => {
    await ctx.plugin(reactHost, { el })
    await ctx.plugin(shell)
  })
  assert.match(el.innerHTML, /hmr-dev/)
})
