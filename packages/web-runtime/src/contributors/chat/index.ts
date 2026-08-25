import type { Context } from 'cordis'
import { bindSessionView, type SessionViewService } from '../../infrastructure/session-view.ts'
import { ApprovalsRail } from './approvals.tsx'
import { ChatComposer } from './composer.tsx'
import { ChatConfig } from './config.tsx'
import { ChatConfigBanner } from './config-banner.tsx'
import { ChatThread } from './thread.tsx'
import { TrajectoryView } from './trajectory.tsx'
import { bindProjectView, type ProjectViewService } from '../../infrastructure/project-view.ts'

export const name = 'chat-ui'
export const inject = ['slots', 'sessionView', 'projectView']

export function apply(ctx: Context) {
  const view = ctx.sessionView as SessionViewService
  const project = ctx.projectView as ProjectViewService
  // 稳定 props：避免 Shell 重绘时 bind* 新函数打穿 memo（重 Markdown 切换卡顿）
  const slotProps = {
    useSessionView: bindSessionView(view),
    sessionView: view,
    useProjectView: bindProjectView(project),
    projectView: project,
  }
  const props = () => slotProps
  ctx.slots.place('stage', ChatThread, { key: 'chat-thread', order: 1, props })
  ctx.slots.place('trajectory', TrajectoryView, { key: 'trajectory', order: 1, props })
  // project 胶囊嵌在 dock ApprovalsRail 胶囊行，不再单独占顶栏
  ctx.slots.place('composer', ChatComposer, { key: 'chat', order: 10, props })
  ctx.slots.place('dock', ChatConfigBanner, { key: 'chat-config-banner', order: 1 })
  ctx.slots.place('dock', ApprovalsRail, { key: 'approvals', order: 5, props })
  ctx.slots.place('models', ChatConfig, { key: 'chat-config', order: 10 })
}
