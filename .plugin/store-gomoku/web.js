const React = globalThis.React
const { useState, useCallback } = React

export const name = 'store-gomoku'
export const inject = ['slots']

const SIZE = 16
const CELL = 20
const FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Hiragino Sans GB", sans-serif'

function initBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0))
}

function checkWin(board, row, col, player) {
  const dirs = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ]
  for (const [dr, dc] of dirs) {
    let count = 1
    for (let i = 1; i < 5; i++) {
      const r = row + dr * i
      const c = col + dc * i
      if (r < 0 || r >= SIZE || c < 0 || c >= SIZE || board[r][c] !== player) break
      count++
    }
    for (let i = 1; i < 5; i++) {
      const r = row - dr * i
      const c = col - dc * i
      if (r < 0 || r >= SIZE || c < 0 || c >= SIZE || board[r][c] !== player) break
      count++
    }
    if (count >= 5) return true
  }
  return false
}

function stoneStyle(player) {
  if (!player) {
    return {
      width: 14,
      height: 14,
      borderRadius: '50%',
      background: 'transparent',
    }
  }
  const black = player === 1
  return {
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: black ? '#0a0a0a' : '#f5f5f7',
    boxShadow: black
      ? 'inset 0 1px 0 rgba(255,255,255,.16), 0 1px 2px rgba(0,0,0,.55)'
      : 'inset 0 -1px 2px rgba(0,0,0,.35), 0 0 0 1px rgba(255,255,255,.12)',
    pointerEvents: 'none',
  }
}

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
        background: 'linear-gradient(180deg, #ffd60a 0%, #ff9f0a 55%, #ff453a 100%)',
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
    '五',
  )
}

function pillStyle(disabled) {
  return {
    border: 'none',
    borderRadius: 999,
    padding: '5px 14px',
    minWidth: 64,
    background: '#3a3a3c',
    color: disabled ? '#636366' : '#0a84ff',
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '-0.01em',
    cursor: disabled ? 'default' : 'pointer',
    fontFamily: FONT,
  }
}

function GomokuCard() {
  const [board, setBoard] = useState(initBoard)
  const [current, setCurrent] = useState(1)
  const [winner, setWinner] = useState(0)
  const [history, setHistory] = useState([])

  const handleClick = useCallback(
    (row, col) => {
      if (winner || board[row][col]) return
      const next = board.map((r) => [...r])
      next[row][col] = current
      setBoard(next)
      setHistory([...history, { row, col }])
      if (checkWin(next, row, col, current)) setWinner(current)
      else setCurrent(current === 1 ? 2 : 1)
    },
    [board, current, winner, history],
  )

  const undo = useCallback(() => {
    if (!history.length || winner) return
    const last = history[history.length - 1]
    const next = board.map((r) => [...r])
    next[last.row][last.col] = 0
    setBoard(next)
    setHistory(history.slice(0, -1))
    setCurrent(history.length % 2 === 1 ? 1 : 2)
  }, [board, history, winner])

  const reset = useCallback(() => {
    setBoard(initBoard())
    setCurrent(1)
    setWinner(0)
    setHistory([])
  }, [])

  const status = winner
    ? `${winner === 1 ? '黑棋' : '白棋'}获胜`
    : `${current === 1 ? '黑棋' : '白棋'}落子`

  const undoDisabled = !history.length || !!winner

  return React.createElement(
    'article',
    {
      'data-testid': 'store-gomoku-card',
      style: {
        width: 360,
        maxWidth: 'min(360px, 100%)',
        borderRadius: 22,
        overflow: 'hidden',
        background: '#1c1c1e',
        color: '#f5f5f7',
        fontFamily: FONT,
        boxShadow: '0 20px 50px rgba(0,0,0,.48), 0 0 0 1px rgba(255,255,255,.06)',
      },
    },
    React.createElement(
      'div',
      {
        style: {
          padding: '18px 18px 12px',
          background:
            'radial-gradient(90% 70% at 100% -10%, rgba(255,255,255,.18), transparent 55%), linear-gradient(165deg, #ff9f0a 0%, #ff453a 48%, #6d1d12 100%)',
          color: '#f5f5f7',
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
            opacity: 0.72,
          },
        },
        'Today',
      ),
      React.createElement(
        'h2',
        {
          style: {
            margin: '6px 0 0',
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '-0.035em',
            lineHeight: 1.1,
          },
        },
        '五子棋',
      ),
      React.createElement(
        'p',
        {
          style: {
            margin: '4px 0 12px',
            fontSize: 14,
            fontWeight: 500,
            opacity: 0.78,
          },
        },
        status,
      ),
      React.createElement(
        'div',
        {
          style: {
            display: 'grid',
            gridTemplateColumns: `repeat(${SIZE}, ${CELL}px)`,
            gridTemplateRows: `repeat(${SIZE}, ${CELL}px)`,
            width: SIZE * CELL,
            margin: '0 auto',
            background: '#2c2c2e',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 0 0 1px rgba(255,255,255,.08)',
            userSelect: 'none',
          },
        },
        board.flatMap((rowArr, r) =>
          rowArr.map((v, c) =>
            React.createElement(
              'div',
              {
                key: `${r}-${c}`,
                onClick: () => handleClick(r, c),
                style: {
                  width: CELL,
                  height: CELL,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'inset 0 0 0 0.5px rgba(255,255,255,.08)',
                  cursor: winner || v ? 'default' : 'pointer',
                },
              },
              React.createElement('div', { style: stoneStyle(v) }),
            ),
          ),
        ),
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
          '五子棋',
        ),
        React.createElement('div', { style: { marginTop: 1, fontSize: 12, color: '#98989d' } }, '游戏'),
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: undo,
          disabled: undoDisabled,
          style: pillStyle(undoDisabled),
        },
        '悔棋',
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: reset,
          style: pillStyle(false),
        },
        '重开',
      ),
    ),
  )
}

export function apply(ctx) {
  ctx.slots.place('plugin-store-extras', GomokuCard, { key: 'store-gomoku', order: 10 })
}
