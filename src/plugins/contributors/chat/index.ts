import type { Context } from 'cordis'
import { ChatComposer } from './composer.tsx'
import { ChatConfig } from './config.tsx'
import { ChatThread } from './thread.tsx'

export const name = 'chat-ui'
export const inject = ['slots']

export function apply(ctx: Context) {
  ctx.slots.inject('stage', () => ctx.slots.fill('stage', ChatThread, { key: 'chat-thread', order: 1 }))
  ctx.slots.inject('composer', () => ctx.slots.fill('composer', ChatComposer, { key: 'chat', order: 10 }))
  ctx.slots.inject('settings', () => ctx.slots.fill('settings', ChatConfig, { key: 'chat-config', order: 10 }))
}
