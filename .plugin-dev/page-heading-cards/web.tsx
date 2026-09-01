export const name = 'page-heading-cards'
export const inject = ['pageEditor']

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

export function apply(ctx: {
  pageEditor: {
    replaceHeading: (level: 1 | 2 | 3, spec: { className?: string; style?: string; label?: string }) => void
  }
}) {
  ctx.pageEditor.replaceHeading(1, card(1, '#7c5cfc'))
  ctx.pageEditor.replaceHeading(2, card(2, '#3b82f6'))
  ctx.pageEditor.replaceHeading(3, card(3, '#22c55e'))
}
