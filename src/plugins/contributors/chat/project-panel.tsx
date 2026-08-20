import type { SlotProps } from '../../registry/slots.ts'
import { bindProjectView, type ProjectViewService } from '../../infrastructure/project-view.ts'

/** Session 绑定 host 工作区：点 Open folder 弹出系统目录框并自动绑定（对齐 dsh）。 */
export function SessionProjectPanel(props: SlotProps) {
  const useProjectView = props.useProjectView as ReturnType<typeof bindProjectView>
  const projectView = props.projectView as ProjectViewService
  const sessionId = useProjectView((state) => state.sessionId)
  const project = useProjectView((state) => state.project)
  const busy = useProjectView((state) => state.busy)
  const error = useProjectView((state) => state.error)

  if (!sessionId) {
    return (
      <div className="project-panel project-panel-empty">
        <p className="text-sm text-[var(--dsw-label-3)]">先创建或打开一个 Session，再选择工作区文件夹。</p>
      </div>
    )
  }

  return (
    <div className="project-panel">
      <header className="project-panel-head">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold tracking-wider text-[var(--dsw-label-3)] uppercase">Workspace</div>
          <div className="truncate text-sm font-semibold" title={project?.path ?? project?.name}>
            {project?.name ?? '未绑定'}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {project ? (
            <button
              type="button"
              className="rounded-[8px] px-2 py-1 text-[11px] text-[var(--dsw-label-3)] hover:bg-black/5"
              disabled={busy}
              onClick={() => void projectView.unbindFolder()}
            >
              Unbind
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-[8px] bg-[var(--dsw-business)] px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-50"
            disabled={busy}
            onClick={() => void projectView.openFolderForSession(sessionId).catch(() => undefined)}
          >
            {project ? 'Rebind' : 'Open folder'}
          </button>
        </div>
      </header>

      <p className="project-panel-hint">
        点击 Open folder，在系统对话框里选目录即自动绑定。之后本 Session 的 bash / str_replace_editor 直接读写该目录。
      </p>

      {project?.path ? (
        <p className="project-panel-hint truncate" title={project.path}>
          当前 cwd：{project.path}
        </p>
      ) : (
        <div className="project-panel-empty">
          <p className="text-sm leading-6 text-[var(--dsw-label-2)]">尚未绑定工作区。选择一个本机项目文件夹开始。</p>
        </div>
      )}
      {error ? <p className="project-panel-error">{error}</p> : null}
    </div>
  )
}
