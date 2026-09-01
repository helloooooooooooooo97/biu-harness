import { test } from 'vitest'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Context } from 'cordis'
import * as slots from '@biu/web-slots'
import * as dock from '@biu/core-dock'
import * as appModules from '@biu/web-app-modules'
import * as snapshot from '@biu/web-snapshot'
import * as sessionView from '@biu/web-session-view'
import * as projectView from '@biu/web-project-view'
import * as shell from './index.tsx'

test('declares generic module slots, not plugin ids', async () => {
  const ctx = new Context()
  await ctx.plugin(slots)
  await ctx.plugin(dock)
  await ctx.plugin(appModules)
  await ctx.plugin(sessionView)
  await ctx.plugin(projectView)
  await ctx.plugin(snapshot)
  await ctx.plugin(shell)
  assert.equal(ctx.slots.specOf('sidebar')?.kind, 'single')
  assert.equal(ctx.slots.specOf('demos')?.kind, 'list')
  assert.equal(ctx.slots.specOf('app-modules')?.kind, 'list')
  assert.equal(ctx.slots.specOf('inspector-panels')?.kind, 'list')
  assert.equal(ctx.slots.specOf('header-tools')?.kind, 'list')
  assert.equal(ctx.slots.specOf('stage-aside')?.kind, 'single')
  assert.equal(ctx.slots.specOf('corner-tools')?.kind, 'list')
  assert.equal(ctx.slots.specOf('root-overlays')?.kind, 'list')
  assert.equal(ctx.slots.specOf('tasks'), undefined)
  assert.equal(ctx.slots.specOf('channels'), undefined)
  assert.equal(ctx.slots.specOf('dashboard'), undefined)
  assert.equal(ctx.slots.list('root').length, 1)
  assert.equal(
    ctx.slots.list('inspector-panels').some((item) => item.id === 'common-add-view' || item.id === 'common-copy-view'),
    false,
  )
})

test('update button does not download when already current', () => {
  const nav = readFileSync(resolve(import.meta.dirname, './shell-dock-nav.tsx'), 'utf8')
  assert.match(nav, /相对于主分支暂时无最新提交版本/)
  assert.match(nav, /if \(behind <= 0\)/)
  assert.match(nav, /os-dock-update-toast/)
  assert.match(nav, /activeId !== 'agent'/)
  assert.match(nav, /setChatOverlay\(false\)/)
})

test('refresh does not send unfinished plugin routes home', () => {
  const shell = readFileSync(resolve(import.meta.dirname, './index.tsx'), 'utf8')
  assert.doesNotMatch(shell, /navigate\('\/', \{ replace: true \}\)/)
  assert.match(shell, /waitingOnNav/)
})
