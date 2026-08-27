const React = globalThis.React

export const name = 'store-hello-web'
export const inject = ['slots']

function AppIcon() {
  return React.createElement(
    'div',
    {
      'aria-hidden': true,
      style: {
        width: 52,
        height: 52,
        flexShrink: 0,
        borderRadius: 12,
        background: 'linear-gradient(180deg, #64d2ff 0%, #0071e3 52%, #147ce5 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.4), 0 1px 2px rgba(0,0,0,.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: 22,
        fontWeight: 700,
        letterSpacing: '-0.06em',
      },
    },
    'H',
  )
}

function HelloBanner() {
  const [got, setGot] = React.useState(false)

  async function onGet() {
    try {
      await fetch('/api/store-hello')
    } catch {
      /* banner still works if host is off */
    }
    setGot(true)
  }

  return React.createElement(
    'article',
    {
      'data-testid': 'store-hello-banner',
      style: {
        width: 360,
        maxWidth: 'min(360px, 100%)',
        borderRadius: 22,
        overflow: 'hidden',
        background: '#1c1c1e',
        color: '#f5f5f7',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Hiragino Sans GB", sans-serif',
        boxShadow: '0 20px 50px rgba(0,0,0,.48), 0 0 0 1px rgba(255,255,255,.06)',
      },
    },
    React.createElement(
      'div',
      {
        style: {
          minHeight: 228,
          padding: '22px 22px 28px',
          background:
            'radial-gradient(90% 70% at 100% -10%, rgba(255,255,255,.45), transparent 55%), linear-gradient(165deg, #5ac8fa 0%, #007aff 38%, #5856d6 100%)',
          color: '#fff',
        },
      },
      React.createElement(
        'div',
        {
          style: {
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            opacity: 0.82,
          },
        },
        'Today',
      ),
      React.createElement(
        'h2',
        {
          style: {
            margin: '8px 0 0',
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: '-0.035em',
            lineHeight: 1.08,
          },
        },
        'Hello',
      ),
      React.createElement(
        'p',
        {
          style: {
            margin: '8px 0 0',
            fontSize: 16,
            fontWeight: 400,
            letterSpacing: '-0.01em',
            opacity: 0.92,
          },
        },
        '商店插件已运行',
      ),
    ),
    React.createElement(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px 14px',
          background: '#2c2c2e',
          borderTop: '1px solid rgba(255,255,255,.08)',
        },
      },
      React.createElement(AppIcon),
      React.createElement(
        'div',
        { style: { flex: 1, minWidth: 0 } },
        React.createElement(
          'div',
          { style: { fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', color: '#f5f5f7' } },
          'Hello',
        ),
        React.createElement(
          'div',
          { style: { marginTop: 1, fontSize: 12, color: '#98989d' } },
          '效率',
        ),
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: onGet,
          style: {
            border: 'none',
            borderRadius: 999,
            padding: '5px 14px',
            minWidth: 72,
            background: '#3a3a3c',
            color: '#0a84ff',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            cursor: 'pointer',
          },
        },
        got ? '打开' : '获取',
      ),
    ),
  )
}

export function apply(ctx) {
  ctx.slots.place('plugin-store-extras', HelloBanner, {
    key: 'store-hello-banner',
    order: 10,
  })
}
