import type { SlotProps } from '../../registry/slots.ts'
import { bindProjectView, type ProjectViewService } from '../../infrastructure/project-view.ts'
import type { DirEntry } from '../../infrastructure/session-folder.ts'

function TreeRows({
  entries,
  depth,
  expanded,
  childrenMap,
  openPath,
  onToggle,
  onOpen,
}: {
  entries: DirEntry[]
  depth: number
  expanded: string[]
  childrenMap: Record<string, DirEntry[]>
  openPath?: string
  onToggle: (path: string) => void
  onOpen: (path: string) => void
}) {
  return (
    <>
      {entries.map((entry) => {
        const isOpen = expanded.includes(entry.path)
        const active = openPath === entry.path
        return (
          <div key={entry.path}>
            <button
              type="button"
              className={`project-tree-row${active ? ' is-active' : ''}`}
              style={{ paddingLeft: 8 + depth * 12 }}
              onClick={() => {
                if (entry.kind === 'directory') onToggle(entry.path)
                else onOpen(entry.path)
              }}
            >
              <span className="project-tree-icon" aria-hidden>
                {entry.kind === 'directory' ? (isOpen ? '▾' : '▸') : '·'}
              </span>
              <span className="truncate">{entry.name}</span>
            </button>
            {entry.kind === 'directory' && isOpen && childrenMap[entry.path] ? (
              <TreeRows
                entries={childrenMap[entry.path]!}
                depth={depth + 1}
                expanded={expanded}
                childrenMap={childrenMap}
                openPath={openPath}
                onToggle={onToggle}
                onOpen={onOpen}
              />
            ) : null}
          </div>
        )
      })}
    </>
  )
}

/** Session 绑定的本地项目：树 + 文本编辑。 */
export function SessionProjectPanel(props: SlotProps) {
  const useProjectView = props.useProjectView as ReturnType<typeof bindProjectView>
  const projectView = props.projectView as ProjectViewService
  const sessionId = useProjectView((state) => state.sessionId)
  const project = useProjectView((state) => state.project)
  const handleReady = useProjectView((state) => state.handleReady)
  const entries = useProjectView((state) => state.entries)
  const expanded = useProjectView((state) => state.expanded)
  const children = useProjectView((state) => state.children)
  const openPath = useProjectView((state) => state.openPath)
  const content = useProjectView((state) => state.content)
  const dirty = useProjectView((state) => state.dirty)
  const busy = useProjectView((state) => state.busy)
  const error = useProjectView((state) => state.error)
  const supported = projectView.supported()

  if (!sessionId) {
    return (
      <div className="project-panel project-panel-empty">
        <p className="text-sm text-[var(--dsw-label-3)]">先创建或打开一个 Session，再绑定本地文件夹。</p>
      </div>
    )
  }

  return (
    <div className="project-panel">
      <header className="project-panel-head">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold tracking-wider text-[var(--dsw-label-3)] uppercase">Project</div>
          <div className="truncate text-sm font-semibold" title={project?.name}>
            {project?.name ?? '未绑定文件夹'}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {project && handleReady ? (
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
            disabled={busy || !supported}
            onClick={() => void projectView.openFolderForSession(sessionId).catch(() => undefined)}
          >
            {project ? 'Rebind' : 'Open folder'}
          </button>
        </div>
      </header>

      {!supported ? (
        <p className="project-panel-hint">需要 Chromium 系浏览器的 File System Access API 才能打开本地文件夹。</p>
      ) : null}
      {error ? <p className="project-panel-error">{error}</p> : null}

      {!project ? (
        <div className="project-panel-empty">
          <p className="text-sm leading-6 text-[var(--dsw-label-2)]">
            为本 Session 打开一个本地文件夹，即可浏览与编辑文件。每个 Session 绑定一个项目目录。
          </p>
        </div>
      ) : !handleReady ? (
        <div className="project-panel-empty">
          <p className="text-sm leading-6 text-[var(--dsw-label-2)]">
            已记录项目「{project.name}」，但浏览器句柄未授权。请点 Rebind 重新选择同一文件夹。
          </p>
        </div>
      ) : (
        <div className="project-panel-body">
          <div className="project-tree">
            <TreeRows
              entries={entries}
              depth={0}
              expanded={expanded}
              childrenMap={children}
              openPath={openPath}
              onToggle={(path) => void projectView.toggleDir(path)}
              onOpen={(path) => void projectView.openFile(path)}
            />
          </div>
          <div className="project-editor">
            <div className="project-editor-toolbar">
              <span className="min-w-0 truncate font-mono text-[11px] text-[var(--dsw-label-3)]">
                {openPath ?? 'Select a file'}
                {dirty ? ' · unsaved' : ''}
              </span>
              <button
                type="button"
                className="rounded-[8px] px-2 py-1 text-[11px] font-medium text-[var(--dsw-business)] hover:bg-[var(--dsw-business-soft)] disabled:opacity-40"
                disabled={!openPath || !dirty || busy}
                onClick={() => void projectView.save()}
              >
                Save
              </button>
            </div>
            <textarea
              className="project-editor-textarea"
              value={openPath ? content : ''}
              disabled={!openPath || busy}
              spellCheck={false}
              onChange={(event) => projectView.setContent(event.target.value)}
              placeholder={openPath ? '' : '从左侧选择文件开始编辑'}
            />
          </div>
        </div>
      )}
    </div>
  )
}
