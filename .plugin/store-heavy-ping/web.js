const React = globalThis.React

export const name = 'store-heavy-ping-web'
export const inject = ['slots']

function HeavyPingDockIcon(props) {
  const className = props && props.className ? String(props.className) : 'size-5'
  return React.createElement(
    'svg',
    { viewBox: '0 0 16 16', fill: 'currentColor', className, 'aria-hidden': true },
    React.createElement('path', {
      'fill-rule': 'evenodd',
      d: 'M9.58 1.18a.75.75 0 0 1 .4.96L8.16 7h3.59a.75.75 0 0 1 .6 1.2l-5.5 6.5a.75.75 0 0 1-1.33-.68L7.84 9H4.25a.75.75 0 0 1-.6-1.2l5.5-6.5a.75.75 0 0 1 .83-.12Z',
      'clip-rule': 'evenodd',
    }),
  )
}

function HeavyPingCard() {
  const [status, setStatus] = React.useState('idle')
  const [body, setBody] = React.useState(null)

  async function ping() {
    setStatus('loading')
    try {
      const res = await fetch('/api/store-heavy-ping')
      const data = await res.json()
      setBody(data)
      setStatus('ok')
    } catch (error) {
      setBody({ error: String(error) })
      setStatus('err')
    }
  }

  return React.createElement(
    'article',
    {
      'data-testid': 'store-heavy-ping-card',
      style: {
        boxSizing: 'border-box',
        width: '100%',
        height: '100%',
        padding: 20,
        background: '#1c1c1e',
        color: '#f5f5f7',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Hiragino Sans GB", sans-serif',
      },
    },
    React.createElement('h2', { style: { margin: 0, fontSize: 22, fontWeight: 700 } }, 'Heavy Ping'),
    React.createElement(
      'p',
      { style: { margin: '8px 0 16px', fontSize: 13, opacity: 0.72 } },
      '多文件打包插件。点一下打 host。',
    ),
    React.createElement(
      'button',
      {
        type: 'button',
        onClick: ping,
        style: {
          border: 0,
          borderRadius: 8,
          padding: '8px 12px',
          background: '#007aff',
          color: '#fff',
          fontWeight: 600,
          cursor: 'pointer',
        },
      },
      status === 'loading' ? 'Pinging…' : 'Ping',
    ),
    body
      ? React.createElement(
          'pre',
          { style: { marginTop: 16, fontSize: 12, whiteSpace: 'pre-wrap' } },
          JSON.stringify(body, null, 2),
        )
      : null,
  )
}

export function apply(ctx) {
  ctx.slots.place('plugin-store-extras', HeavyPingCard, {
    key: 'store-heavy-ping',
    order: 20,
    props: () => ({ Icon: HeavyPingDockIcon }),
  })
}
