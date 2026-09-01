export const name = 'page-heading-cards'
export const inject = ['pageEditor', 'slots']

function card(level: 1 | 2 | 3, accent: string) {
  return {
    label: `H${level}`,
    className: 'page-heading-card',
    style: [
      `border-left:4px solid ${accent}`,
      'padding:8px 12px',
      'margin:2px 0',
      `background:color-mix(in srgb, ${accent} 14%, transparent)`,
    ].join(';'),
  }
}

function Panel() {
  return (
    <div
      data-testid="page-heading-cards-panel"
      style={{
        boxSizing: 'border-box',
        width: '100%',
        height: '100%',
        padding: 16,
        font: '13px/1.5 ui-sans-serif, system-ui, sans-serif',
      }}
    >
      已给页面 H1 / H2 / H3 套上卡片皮肤。标题仍是原生 heading，方向键可以上下移动。关掉本插件后恢复默认样式。
    </div>
  )
}

function Icon(props: { className?: string }) {
  const className = props.className ?? 'size-5'
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <path d="M3 3h10v2H3V3Zm0 4h7v2H3V7Zm0 4h10v2H3v-2Z" />
    </svg>
  )
}

export function apply(ctx: {
  pageEditor: {
    replaceHeading: (level: 1 | 2 | 3, spec: { className?: string; style?: string; label?: string }) => void
  }
  slots: {
    place: (slot: string, Comp: unknown, options: { key: string; props: () => { Icon: unknown } }) => void
  }
}) {
  ctx.pageEditor.replaceHeading(1, card(1, '#7c5cfc'))
  ctx.pageEditor.replaceHeading(2, card(2, '#3b82f6'))
  ctx.pageEditor.replaceHeading(3, card(3, '#22c55e'))
  ctx.slots.place('plugin-store-extras', Panel, {
    key: 'page-heading-cards',
    props: () => ({ Icon }),
  })
}
