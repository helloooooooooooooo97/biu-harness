import type { Context } from 'cordis'
import { ChatComposer } from './composer.tsx'
import { ChatConfig } from './config.tsx'
import { ChatThread } from './thread.tsx'

export const name = 'chat-ui'
export const inject = ['slots']

export function apply(ctx: Context) {
  ctx.slots.place('stage', ChatThread, { key: 'chat-thread', order: 1 })
  ctx.slots.place('composer', ChatComposer, { key: 'chat', order: 10 })
  ctx.slots.place('settings', ChatConfig, { key: 'chat-config', order: 10 })
}
