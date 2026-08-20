import type { SlotProps } from '../../registry/slots.ts'
import { bindProjectView, type ProjectViewService } from '../../infrastructure/project-view.ts'

/** Session 绑定 host 本机路径（对齐 dsh workspace）：Agent 工具直接读写该目录。 */
export function SessionProjectPanel(props: SlotProps) {
  const useProjectView = props.useProjectView as ReturnType<typeof bindProjectView>
  const projectView = props.projectView as ProjectViewService
  const sessionId = useProjectView((state) => state.sessionId)
  const project = useProjectView((state) => state.project)
  const pathInput = useProjectView((state) => state.pathInput)
  const busy = useProjectView((state) => state.busy)
  const error = useProjectView((state) => state.error)

  if (!sessionId) {
    return (
      <div className="project-panel project-panel-empty">
        <p className="text-sm text-[var(--dsw-label-3)]">先创建或打开一个 Session，再绑定 host 工作区路径。</p>
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
            disabled={busy || !pathInput.trim()}
            onClick={() => void projectView.bindHostPath(sessionId).catch(() => undefined)}
          >
            {project ? 'Rebind' : 'Bind'}
          </button>
        </div>
      </header>

      <p className="project-panel-hint">
        填写 <strong>跑 host 的机器</strong>上的绝对路径（与 dsh Choose workspace 相同）。绑定后本 Session 的
        bash / str_replace_editor 直接读写该目录，无需浏览器同步。
      </p>

      <label className="block px-3 pb-2 text-[11px] text-[var(--dsw-label-3)]">
        Host path
        <input
          className="mt-1 w-full rounded-[8px] border border-[var(--dsw-border)] bg-white px-2 py-1.5 text-sm text-[var(--dsw-label)] outline-none"
          value={pathInput}
          placeholder="/absolute/path/to/project"
          disabled={busy}
          onChange={(event) => projectView.setPathInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && pathInput.trim()) {
              void projectView.bindHostPath(sessionId).catch(() => undefined)
            }
          }}
        />
      </label>

      {project?.path ? (
        <p className="project-panel-hint truncate" title={project.path}>
          当前 cwd：{project.path}
        </p>
      ) : null}
      {error ? <p className="project-panel-error">{error}</p> : null}
    </div>
  )
}
