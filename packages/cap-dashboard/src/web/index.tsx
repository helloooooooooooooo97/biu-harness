import type { Context } from 'cordis'
import { LuLayoutDashboard } from 'react-icons/lu'
import { DashboardModule } from './page.tsx'

type SlotsService = {
  place: (slot: string, view: unknown, opts: { key: string; order: number; props?: () => Record<string, unknown> }) => unknown
}

type AppModulesService = {
  register: (mod: {
    id: string
    label: string
    path: string
    description?: string
    order?: number
    Icon?: (props: { className?: string }) => unknown
  }) => unknown
}

const moduleProps = { moduleId: 'dashboard' }

export const name = 'dashboard-ui'
export const inject = ['slots', 'appModules']

export function apply(ctx: Context) {
  const slots = ctx.get('slots') as SlotsService | undefined
  const appModules = ctx.get('appModules') as AppModulesService | undefined
  if (!slots) throw new Error('slots service required')
  if (!appModules) throw new Error('appModules service required')
  appModules.register({
    id: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    description: 'Usage and project overview console',
    order: 80,
    Icon: LuLayoutDashboard,
  })
  slots.place('app-modules', DashboardModule, { key: 'dashboard-module', order: 80, props: () => moduleProps })
}

if (typeof document !== 'undefined') {
  const id = 'biu-dashboard-ui-style'
  const style = document.getElementById(id) ?? document.createElement('style')
  style.id = id
  style.textContent = `
.dash-root{display:flex;min-height:0;flex:1;flex-direction:column;gap:20px;overflow:auto;padding:28px 32px 40px}
.dash-header{display:flex;align-items:flex-end;justify-content:space-between;gap:16px}
.dash-title{margin:0;color:var(--dsw-label);font-size:28px;font-weight:650;letter-spacing:-.03em;line-height:1.15}
.dash-subtitle{margin:6px 0 0;color:var(--dsw-label-3);font-size:13px}
.dash-updated{color:var(--dsw-label-3);font-family:var(--font-mono);font-size:11px}
.dash-muted,.dash-error{margin:0;font-size:13px}
.dash-muted{color:var(--dsw-label-3)}
.dash-error{color:var(--dsw-danger)}
.dash-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.dash-card{border:1px solid var(--dsw-border);border-radius:14px;background:color-mix(in srgb,var(--dsw-surface) 92%,var(--dsw-business-soft));padding:14px 16px}
.dash-card-label{color:var(--dsw-label-3);font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase}
.dash-card-value{margin-top:8px;color:var(--dsw-label);font-family:var(--font-mono);font-size:22px;font-weight:600;letter-spacing:-.02em}
.dash-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.dash-panel{border:1px solid var(--dsw-border);border-radius:16px;background:var(--dsw-surface);padding:16px 18px 18px}
.dash-panel-wide{grid-column:1/-1}
.dash-panel-title{margin:0 0 14px;color:var(--dsw-label);font-size:14px;font-weight:600}
.dash-bars{display:flex;flex-direction:column;gap:8px}
.dash-bar-row{display:grid;grid-template-columns:48px minmax(0,1fr) 72px;align-items:center;gap:10px}
.dash-bar-label,.dash-bar-value{color:var(--dsw-label-3);font-family:var(--font-mono);font-size:11px}
.dash-bar-value{text-align:right;color:var(--dsw-label-2)}
.dash-bar-track{height:8px;overflow:hidden;border-radius:999px;background:var(--dsw-hover)}
.dash-bar-fill{height:100%;border-radius:inherit;background:linear-gradient(90deg,color-mix(in srgb,var(--dsw-business) 70%,#8fd3c8),var(--dsw-business))}
.dash-table{width:100%;border-collapse:collapse;font-size:13px}
.dash-table th,.dash-table td{padding:10px 8px;border-bottom:1px solid var(--dsw-border);text-align:left;vertical-align:top}
.dash-table th{color:var(--dsw-label-3);font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase}
.dash-table td:nth-child(2),.dash-table td:nth-child(3),.dash-table th:nth-child(2),.dash-table th:nth-child(3){width:72px;text-align:right;font-family:var(--font-mono)}
.dash-project-name{color:var(--dsw-label);font-weight:550}
.dash-project-path{margin-top:2px;color:var(--dsw-label-3);font-family:var(--font-mono);font-size:11px}
@media (max-width:960px){.dash-cards{grid-template-columns:repeat(2,minmax(0,1fr))}.dash-grid{grid-template-columns:1fr}.dash-root{padding:20px 18px 32px}}
`
  if (!document.getElementById(id)) document.head.appendChild(style)
}
