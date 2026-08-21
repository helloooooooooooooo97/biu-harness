import type { SlotProps } from '../../registry/slots.ts'
import { bindProjectView, type ProjectViewService } from '../../infrastructure/project-view.ts'

/** 紧凑项目绑定：输入框上方左侧，与标准/极简胶囊同一行。 */
export function SessionProjectPanel(props: SlotProps) {
  const useProjectView = props.useProjectView as ReturnType<typeof bindProjectView>
  const projectView = props.projectView as ProjectViewService
  const sessionId = useProjectView((state) => state.sessionId)
  const project = useProjectView((state) => state.project)
  const busy = useProjectView((state) => state.busy)
  const error = useProjectView((state) => state.error)

  if (!sessionId) {
    return (
      <div className="project-chip project-chip-muted" title="先打开一个 Session">
        <FolderGlyph />
        <span>No session</span>
      </div>
    )
  }

  return (
    <div className="project-chip-wrap">
      <button
        type="button"
        className={`project-chip${project ? '' : ' project-chip-empty'}${busy ? ' is-busy' : ''}`}
        disabled={busy}
        title={project?.path ?? '选择本机文件夹并绑定为 Session cwd'}
        onClick={() => void projectView.openFolderForSession(sessionId).catch(() => undefined)}
      >
        <FolderGlyph />
        <span className="project-chip-name">{project?.name ?? 'Bind project'}</span>
      </button>
      {error ? <span className="project-chip-error" title={error}>!</span> : null}
    </div>
  )
}

function FolderGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="project-chip-icon" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 8.5V18a1.5 1.5 0 0 0 1.5 1.5h14A1.5 1.5 0 0 0 20.5 18V10A1.5 1.5 0 0 0 19 8.5h-7.2L10 6.5H5A1.5 1.5 0 0 0 3.5 8v.5z" />
    </svg>
  )
}
