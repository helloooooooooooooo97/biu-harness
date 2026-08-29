import type { Context } from 'cordis'
import type { DatabaseUi } from '@biu/type-file-system/ui'
import { tasksChrome } from './chrome.tsx'

export const name = 'tasks-2-ui'
export const inject = ['databaseUi']

export function apply(ctx: Context) {
  const ui = ctx.get('databaseUi') as DatabaseUi
  ctx.effect(() => ui.decorate('/tasks', tasksChrome).dispose)
}

if (typeof document !== 'undefined') {
  const id = 'biu-tasks-2-ui-style'
  const style = document.getElementById(id) ?? document.createElement('style')
  style.id = id
  style.textContent = `
.tasks2-title{display:inline-flex;align-items:center;gap:6px;min-width:0;max-width:100%}
.tasks2-title.is-done{text-decoration:line-through;color:var(--dsw-label-3)}
.tasks-queue-chain{color:var(--dsw-label-3);font-weight:500}
.tasks-queue-lock{flex:none;display:inline-flex;color:#9a6700}
.tasks-queue-pill{flex:none;display:inline-flex;align-items:center;gap:3px;border-radius:999px;padding:1px 6px;font-size:14px;font-weight:700;white-space:nowrap}
.tasks-queue-pill.is-p-high{color:var(--dsw-danger);background:color-mix(in srgb,var(--dsw-danger) 12%,transparent)}
.tasks-queue-pill.is-p-med{color:var(--dsw-business);background:color-mix(in srgb,var(--dsw-business) 12%,transparent)}
.tasks-queue-pill.is-p-low{color:var(--dsw-label-3);background:color-mix(in srgb,var(--dsw-label-3) 12%,transparent)}
.tasks-queue-overdue{flex:none;display:inline-flex;align-items:center;gap:3px;border-radius:999px;padding:1px 6px;font-size:14px;font-weight:700;white-space:nowrap;color:var(--dsw-danger);background:color-mix(in srgb,var(--dsw-danger) 12%,transparent)}
.tasks-queue-assignee{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px;color:var(--dsw-label-2)}
.tasks-graph-status{font-size:14px;font-weight:650;color:var(--dsw-label-3)}
.tasks-graph-status.is-todo{color:var(--dsw-label-3)}
.tasks-graph-status.is-doing{color:var(--dsw-business)}
.tasks-graph-status.is-done{color:#2f7d4c}
.tasks-proj-tag{display:inline-block;padding:1px 8px;border-radius:999px;font-size:14px;font-weight:600;color:var(--dsw-label-2);background:color-mix(in srgb,var(--dsw-border) 55%,transparent);white-space:nowrap}
.tasks-tags{display:inline-flex;flex-wrap:wrap;gap:3px;vertical-align:middle}
.tasks-tag{display:inline-flex;align-items:center;padding:1px 8px;border-radius:999px;font-size:14px;font-weight:600;color:var(--tag,#3b6fd9);background:color-mix(in srgb,var(--tag,#3b6fd9) 12%,transparent);white-space:nowrap;max-width:110px;overflow:hidden;text-overflow:ellipsis}
.tasks-status-cell{display:inline-flex;align-items:center;gap:5px;min-width:0}
.tasks-actor{display:inline-flex;align-items:center;gap:6px;min-width:0;max-width:100%}
.tasks-actor.is-empty{color:var(--dsw-label-3)}
.tasks-actor-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
.tasks-session-face{flex:none;display:inline-flex;line-height:0}
.tasks-actor .sidebar-mascot,.tasks-assignee-option .sidebar-mascot{flex:none}
.tasks-avatar{flex:none;width:16px;height:16px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;background:var(--dsw-muted-fill);color:var(--dsw-label-2);font-size:10px;font-weight:700}
.tasks-avatar-clear{color:var(--dsw-label-3)}
.tasks-assignee-picker{position:relative;display:inline-flex;min-width:0;width:100%}
.tasks-assignee-trigger{display:inline-flex;align-items:center;gap:4px;min-width:0;max-width:100%;border:0;background:transparent;padding:2px 4px;border-radius:5px;color:inherit;font:inherit;cursor:pointer;text-align:left}
.tasks-assignee-trigger:hover,.tasks-assignee-trigger[data-open]{background:var(--dsw-hover)}
.tasks-float-menu{max-width:280px;max-height:260px;overflow:auto;padding:4px;background:var(--dsw-sidebar);border:1px solid var(--dsw-border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.18);display:flex;flex-direction:column;gap:1px}
.tasks-assignee-option,.tasks-cellselect-option{display:flex;align-items:center;gap:6px;width:100%;border:0;background:transparent;padding:5px 6px;border-radius:5px;font:inherit;color:var(--dsw-label);cursor:pointer;text-align:left}
.tasks-assignee-option:hover,.tasks-cellselect-option:hover{background:var(--dsw-hover)}
.tasks-assignee-option.is-selected,.tasks-cellselect-option.is-selected{background:color-mix(in srgb,var(--dsw-business) 14%,transparent)}
.tasks-assignee-loading{display:flex;align-items:center;gap:6px;padding:6px;color:var(--dsw-label-3);font-size:11px}
.tasks-cellselect{position:relative;display:inline-flex;min-width:0;width:100%}
.tasks-cellselect-trigger{display:inline-flex;align-items:center;gap:5px;width:100%;min-width:0;border:0;border-radius:6px;padding:3px 7px;background:transparent;color:var(--dsw-label);font:inherit;font-size:14px;font-weight:600;cursor:pointer;text-align:left}
.tasks-cellselect-trigger:hover,.tasks-cellselect-trigger[data-open]{background:var(--dsw-hover)}
.tasks-cellselect-trigger.is-todo{color:var(--dsw-label-3)}
.tasks-cellselect-trigger.is-doing{color:var(--dsw-business)}
.tasks-cellselect-trigger.is-done{color:#2f7d4c}
.tasks-cellselect-trigger.is-p-high{color:var(--dsw-danger)}
.tasks-cellselect-trigger.is-p-med{color:var(--dsw-business)}
.tasks-cellselect-trigger.is-p-low{color:var(--dsw-label-3)}
.tasks-cellselect-trigger.is-d-high{color:#d64545}
.tasks-cellselect-trigger.is-d-med{color:#e07a2f}
.tasks-cellselect-trigger.is-d-low{color:#3d9a5f}
.tasks-chip-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tasks-cell-input{min-width:0;width:100%;border:0;border-radius:6px;padding:3px 6px;background:transparent;color:var(--dsw-label);font:inherit;font-size:14px;font-weight:600}
.tasks-cell-input:hover,.tasks-cell-input:focus{background:var(--dsw-hover);outline:none}
.tasks-tag-input{min-width:64px;max-width:110px;border:0;border-radius:999px;padding:1px 8px;background:transparent;color:var(--dsw-label);font:inherit;font-size:13px}
.tasks-tag-input:focus{background:var(--dsw-hover);outline:none}
.tasks-due-edit{display:inline-flex;align-items:center;gap:4px;min-width:0;width:100%;color:var(--dsw-label-2)}
.tasks-due-edit.is-overdue{color:var(--dsw-danger)}
`
  if (!document.getElementById(id)) document.head.appendChild(style)
}
