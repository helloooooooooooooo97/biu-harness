import type { Context } from 'cordis'
import type { SlotProps } from '../ui-slots/types.ts'
import type { Snapshot } from '../runtime/snapshot.ts'

export const name = 'shell'
export const inject = ['slots', 'snapshot']

function RootShell(props: SlotProps) {
  const snap = props.useSnapshot((state) => state as Snapshot)
  const live = snap.plugins.some((plugin) => plugin.enabled)

  return (
    <>
      <header className="top">
        <div>
          <p className="kicker">Cordis × DeepSeek Harness × React</p>
          <h1>一切皆插件</h1>
        </div>
        <p className="lede">
          对齐 Harness 前端三层：runtime 无 React；ui-slots 只有{' '}
          <code>register / inject</code>；web-react 安装 renderer。壳只渲染{' '}
          <code>root</code>，业务插件用 <code>slots.inject</code> 贡献组件，组件本身不碰 ctx。
        </p>
      </header>
      <main className="grid">
        <section className="panel plugins">
          <div className="panel-head">
            <h2>插件树</h2>
            <span className={`live${live ? ' on' : ''}`}>{live ? '实时' : '连接中'}</span>
          </div>
          <p className="hint">声明在 root.children；贡献方走 slots.inject，卸载即撤回。</p>
          {props.renderSlot('sidebar')}
        </section>
        <section className="panel stage">
          <div className="panel-head">
            <h2>能力缝</h2>
            <span className="pills">
              {(snap.services || []).map((name) => (
                <span className="pill" key={name}>
                  ctx.{name}
                </span>
              ))}
            </span>
          </div>
          <div className="pages">{props.renderSlot('stage')}</div>
        </section>
        <section className="panel log">
          <div className="panel-head">
            <h2>事件</h2>
            <span className="mono dim">internal/dispatch</span>
          </div>
          {props.renderSlot('log')}
        </section>
        <section className="panel routes">
          <div className="panel-head">
            <h2>活动路由</h2>
          </div>
          {props.renderSlot('routes')}
        </section>
      </main>
    </>
  )
}

export function apply(ctx: Context) {
  ctx.slots.register(
    {
      name: 'root',
      children: {
        sidebar: { kind: 'single' },
        stage: { kind: 'list' },
        log: { kind: 'single' },
        routes: { kind: 'single' },
      },
      inject: () => ({
        hooks: { snapshot: ctx.snapshot },
      }),
    },
    RootShell,
  )
}
