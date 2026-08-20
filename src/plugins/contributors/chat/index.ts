import type { Context } from 'cordis'
import { bindSessionView, type SessionViewService } from '../../infrastructure/session-view.ts'
import { ApprovalsRail } from './approvals.tsx'
import { ChatComposer } from './composer.tsx'
import { ChatConfig } from './config.tsx'
import { ChatConfigBanner } from './config-banner.tsx'
import { ChatThread } from './thread.tsx'
import { TrajectoryView } from './trajectory.tsx'

export const name = 'chat-ui'
export const inject = ['slots', 'sessionView']

export function apply(ctx: Context) {
  const view = ctx.sessionView as SessionViewService
  const props = () => ({
    useSessionView: bindSessionView(view),
    sessionView: view,
  })
  ctx.slots.place('stage', ChatThread, { key: 'chat-thread', order: 1, props })
  ctx.slots.place('trajectory', TrajectoryView, { key: 'trajectory', order: 1, props })
  ctx.slots.place('composer', ChatComposer, { key: 'chat', order: 10, props })
  ctx.slots.place('dock', ChatConfigBanner, { key: 'chat-config-banner', order: 1 })
  ctx.slots.place('dock', ApprovalsRail, { key: 'approvals', order: 5, props })
  ctx.slots.place('settings', ChatConfig, { key: 'chat-config', order: 10 })
}
