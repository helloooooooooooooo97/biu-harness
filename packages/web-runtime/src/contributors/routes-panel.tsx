import type { Context } from 'cordis'
import type { SlotProps } from '../registry/slots.ts'
import { bindSnapshot, type Snapshot, type SnapshotService } from '../infrastructure/snapshot.ts'

export const name = 'routes-panel'
export const inject = ['slots', 'snapshot']

/** 每种 HTTP 方法的徽章配色（Notion 风格：低饱和底色 + 同色文字）。 */
const METHOD_STYLE: Record<string, { bg: string; fg: string; dot: string }> = {
  GET: { bg: 'rgba(35,131,226,0.12)', fg: '#1c6fb8', dot: '#3583e4' },
  POST: { bg: 'rgba(46,160,67,0.12)', fg: '#1f8a3b', dot: '#2ea043' },
  PUT: { bg: 'rgba(177,99,0,0.12)', fg: '#9a5b00', dot: '#d29922' },
  PATCH: { bg: 'rgba(188,26,105,0.12)', fg: '#a41c62', dot: '#bc1a69' },
  DELETE: { bg: 'rgba(207,34,46,0.12)', fg: '#b0252f', dot: '#cf222e' },
  HEAD: { bg: 'rgba(144,138,255,0.14)', fg: '#5855c7', dot: '#9389ff' },
  OPTIONS: { bg: 'rgba(106,115,129,0.14)', fg: '#525a66', dot: '#6a7381' },
  ALL: { bg: 'rgba(126,88,148,0.14)', fg: '#745082', dot: '#7e5894' },
}

function styleFor(method: string) {
  const key = method.toUpperCase()
  return METHOD_STYLE[key] ?? METHOD_STYLE.ALL
}

function RoutesPanel(props: SlotProps) {
  const useSnapshot = props.useSnapshot as ReturnType<typeof bindSnapshot>
  const routes = useSnapshot((state: Snapshot) => state.routes)
  if (!routes.length) {
    return (
      <div className="rounded-[10px] border border-[var(--dsw-border)] px-4 py-8 text-center text-xs text-[var(--dsw-label-3)]">
        暂无已注册的路由
      </div>
    )
  }
  return (
    <div className="overflow-hidden rounded-[10px] border border-[var(--dsw-border)]">
      {routes.map((route, index) => {
        const style = styleFor(route.method)
        return (
          <div
            key={`${route.method}:${route.pattern}`}
            className="flex items-center gap-3 bg-[var(--dsw-surface)] px-3.5 py-2.5 transition-colors hover:bg-[var(--dsw-hover)]"
            style={index > 0 ? { borderTop: '1px solid var(--dsw-border)' } : undefined}
          >
            <span
              className="inline-flex w-[64px] shrink-0 justify-center rounded-md px-2 py-[3px] text-[10.5px] font-semibold tracking-wide"
              style={{ backgroundColor: style.bg, color: style.fg }}
            >
              {route.method}
            </span>
            <span className="truncate font-mono text-[12px] text-[var(--dsw-label)]">{route.pattern}</span>
          </div>
        )
      })}
    </div>
  )
}

export function apply(ctx: Context) {
  ctx.slots.place('routes', RoutesPanel, {
    key: 'routes',
    props: () => ({ useSnapshot: bindSnapshot(ctx.snapshot as SnapshotService) }),
  })
}
