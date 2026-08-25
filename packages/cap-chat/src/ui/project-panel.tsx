import type { SlotProps } from '@biu/web-slots'
import { bindProjectView, type ProjectViewService } from '@biu/web-project-view'
import { FolderGlyph } from '@biu/web-session-view/folder-glyph'

/** 紧凑项目绑定：始终仅文件夹图标；未绑定虚线框，绑定后实线，无文字/高亮。 */
export function SessionProjectPanel(props: SlotProps) {
  const useProjectView = props.useProjectView as ReturnType<typeof bindProjectView>
  const projectView = props.projectView as ProjectViewService
  const sessionId = useProjectView((state) => state.sessionId)
  const project = useProjectView((state) => state.project)
  const busy = useProjectView((state) => state.busy)
  const error = useProjectView((state) => state.error)

  if (!sessionId) {
    return (
      <div
        className="project-chip project-chip-icon-only project-chip-dashed project-chip-muted"
        title="先打开一个 Session"
        aria-label="先打开一个 Session"
      >
        <FolderGlyph />
      </div>
    )
  }

  const bound = Boolean(project)
  const label = project?.path ?? '选择本机文件夹并绑定为 Session cwd'

  return (
    <div className="project-chip-wrap">
      <button
        type="button"
        className={`project-chip project-chip-icon-only${bound ? '' : ' project-chip-dashed'}${busy ? ' is-busy' : ''}`}
        disabled={busy}
        title={label}
        aria-label={bound ? `已绑定 ${project!.name}` : '绑定项目文件夹'}
        onClick={() => void projectView.openFolderForSession(sessionId).catch(() => undefined)}
      >
        <FolderGlyph />
      </button>
      {error ? (
        <span className="project-chip-error" title={error}>
          !
        </span>
      ) : null}
    </div>
  )
}
