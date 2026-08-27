const React = globalThis.React

export const name = 'store-hello-web'
export const inject = ['slots']

function HelloBanner() {
  return React.createElement(
    'div',
    {
      'data-testid': 'store-hello-banner',
      className:
        'rounded-[8px] border border-[var(--dsw-ok)]/40 bg-[var(--dsw-surface)] px-3 py-2 text-[13px] text-[var(--dsw-label)]',
    },
    'Hello 商店插件已运行',
  )
}

export function apply(ctx) {
  ctx.slots.place('plugin-store-extras', HelloBanner, {
    key: 'store-hello-banner',
    order: 10,
  })
}
