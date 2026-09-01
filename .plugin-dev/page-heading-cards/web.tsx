export const name = 'page-heading-cards'
export const inject = ['pageEditor', 'slots']

function card(level: 1 | 2 | 3, accent: string) {
  return function HeadingCard({ children }: { children?: unknown }) {
    return (
      <div
        data-testid={`page-heading-card-${level}`}
        style={{
          borderLeft: `4px solid ${accent}`,
          padding: '8px 12px',
          margin: '2px 0',
          background: `color-mix(in srgb, ${accent} 14%, transparent)`,
          borderRadius: 8,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.55, letterSpacing: '0.06em' }}>{`H${level}`}</div>
        {children}
      </div>
    )
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
      已替换页面正文的 H1 / H2 / H3。在页面里输入 / 插入标题即可看到卡片样式。关掉本插件后恢复原生标题。
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
    replaceHeading: (
      level: 1 | 2 | 3,
      spec: { View: (props: { level: 1 | 2 | 3; children?: unknown }) => unknown },
    ) => void
  }
  slots: {
    place: (slot: string, Comp: unknown, options: { key: string; props: () => { Icon: unknown } }) => void
  }
}) {
  ctx.pageEditor.replaceHeading(1, { View: card(1, '#7c5cfc') })
  ctx.pageEditor.replaceHeading(2, { View: card(2, '#3b82f6') })
  ctx.pageEditor.replaceHeading(3, { View: card(3, '#22c55e') })
  ctx.slots.place('plugin-store-extras', Panel, {
    key: 'page-heading-cards',
    props: () => ({ Icon }),
  })
}
