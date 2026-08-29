var React = globalThis.React;
var { useState, useCallback } = React;
var name = "gomoku-nordic";
var inject = ["slots"];
var SIZE = 15;
var CELL = 22;
var FONT = '"Avenir Next", "Futura", "Gill Sans", -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Segoe UI", sans-serif';
var STARS = [[3, 3], [3, 11], [11, 3], [11, 11], [7, 7]];
var C = {
  paper: "#f3eee2",
  cardLine: "rgba(118, 100, 66, .18)",
  woodA: "#e9ddc2",
  woodB: "#d0bb90",
  line: "rgba(108, 90, 60, .42)",
  star: "rgba(94, 78, 50, .85)",
  ink: "#46423a",
  sub: "rgba(70, 66, 58, .62)",
  faint: "rgba(70, 66, 58, .35)",
  sage: "#8a9a84",
  sageSoft: "rgba(138, 154, 132, .16)",
  mist: "rgba(154, 168, 162, .5)"
};
function initBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}
function checkWin(board, row, col, player) {
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (const [dr, dc] of dirs) {
    let count = 1;
    for (let i = 1; i < 5; i++) {
      const r = row + dr * i, c = col + dc * i;
      if (r < 0 || r >= SIZE || c < 0 || c >= SIZE || board[r][c] !== player) break;
      count++;
    }
    for (let i = 1; i < 5; i++) {
      const r = row - dr * i, c = col - dc * i;
      if (r < 0 || r >= SIZE || c < 0 || c >= SIZE || board[r][c] !== player) break;
      count++;
    }
    if (count >= 5) return true;
  }
  return false;
}
function stoneStyle(player) {
  if (!player) return null;
  const black = player === 1;
  return {
    width: CELL - 8,
    height: CELL - 8,
    borderRadius: "50%",
    background: black ? "radial-gradient(120% 120% at 34% 28%, #605c51 0%, #39372f 55%, #24221d 100%)" : "radial-gradient(120% 120% at 34% 28%, #fffdf7 0%, #f2ecdb 60%, #e4dbc4 100%)",
    boxShadow: black ? "0 2px 5px rgba(62, 52, 36, .42), inset 0 1px 1px rgba(255,255,255,.16)" : "0 2px 5px rgba(98, 84, 56, .26), inset 0 -1px 2px rgba(150, 136, 104, .22)",
    pointerEvents: "none"
  };
}
function NordicButton({ onClick, disabled, children }) {
  const [hov, setHov] = useState(false);
  return React.createElement(
    "button",
    {
      type: "button",
      onClick,
      disabled,
      onMouseEnter: () => setHov(true),
      onMouseLeave: () => setHov(false),
      style: {
        border: "1px solid " + (disabled ? "rgba(70,66,58,.14)" : hov ? "rgba(112,104,82,.55)" : "rgba(70,66,58,.28)"),
        borderRadius: 4,
        padding: "9px 28px",
        background: disabled ? "transparent" : hov ? C.sageSoft : "transparent",
        color: disabled ? C.faint : C.ink,
        fontSize: 13,
        letterSpacing: "0.22em",
        textIndent: "0.22em",
        cursor: disabled ? "default" : "pointer",
        fontFamily: FONT,
        transition: "all .18s ease"
      }
    },
    children
  );
}
function NordicCard() {
  const [board, setBoard] = useState(initBoard);
  const [current, setCurrent] = useState(1);
  const [winner, setWinner] = useState(0);
  const [draw, setDraw] = useState(false);
  const [history, setHistory] = useState([]);
  const [hover, setHover] = useState(null);
  const over = !!winner || draw;
  const handleClick = useCallback(
    (row, col) => {
      if (over || board[row][col]) return;
      const next = board.map((r) => [...r]);
      next[row][col] = current;
      const win = checkWin(next, row, col, current);
      setBoard(next);
      setHistory([...history, { row, col }]);
      if (win) setWinner(current);
      else if (history.length + 1 >= SIZE * SIZE) setDraw(true);
      else setCurrent(current === 1 ? 2 : 1);
    },
    [board, current, history, over]
  );
  const undo = useCallback(() => {
    if (!history.length || over) return;
    const last = history[history.length - 1];
    const next = board.map((r) => [...r]);
    next[last.row][last.col] = 0;
    setBoard(next);
    setHistory(history.slice(0, -1));
    setCurrent(history.length % 2 === 1 ? 1 : 2);
    setWinner(0);
    setDraw(false);
  }, [board, history, over]);
  const reset = useCallback(() => {
    setBoard(initBoard());
    setCurrent(1);
    setWinner(0);
    setDraw(false);
    setHistory([]);
    setHover(null);
  }, []);
  const status = over ? winner ? winner === 1 ? "\u9ED1\u5B50\u8FDE\u4E94\u83B7\u80DC" : "\u767D\u5B50\u8FDE\u4E94\u83B7\u80DC" : "\u548C\u68CB" : current === 1 ? "\u8F6E\u5230\u9ED1\u5B50" : "\u8F6E\u5230\u767D\u5B50";
  const boardBg = [
    "linear-gradient(to right, " + C.line + " 1px, transparent 1px) 1px 1px / " + CELL + "px 100%",
    "linear-gradient(to bottom, " + C.line + " 1px, transparent 1px) 1px 1px / 100% " + CELL + "px",
    "linear-gradient(150deg, " + C.woodA + " 0%, #dbc9a5 55%, " + C.woodB + " 100%)"
  ].join(", ");
  const cells = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = board[r][c];
      const isStar = STARS.some(([sr, sc]) => sr === r && sc === c);
      const isHover = hover && hover[0] === r && hover[1] === c;
      cells.push(
        React.createElement(
          "div",
          {
            key: r + "-" + c,
            onClick: () => handleClick(r, c),
            onMouseEnter: () => setHover([r, c]),
            onMouseLeave: () => setHover(null),
            style: {
              position: "absolute",
              left: 1 + c * CELL,
              top: 1 + r * CELL,
              width: CELL + 2,
              height: CELL + 2,
              transform: "translate(-50%, -50%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              cursor: over || v ? "default" : "pointer"
            }
          },
          v ? React.createElement("div", { style: stoneStyle(v) }) : isHover ? React.createElement("div", {
            style: {
              width: CELL - 8,
              height: CELL - 8,
              borderRadius: "50%",
              background: current === 1 ? "rgba(58,56,49,.16)" : "rgba(250,247,240,.55)",
              border: "1px solid " + (current === 1 ? "rgba(58,56,49,.28)" : "rgba(255,253,247,.7)"),
              pointerEvents: "none"
            }
          }) : isStar ? React.createElement("div", {
            style: { width: 5, height: 5, borderRadius: "50%", background: C.star, pointerEvents: "none" }
          }) : null
        )
      );
    }
  }
  return React.createElement(
    "div",
    {
      "data-testid": "gomoku-nordic-card",
      style: {
        position: "relative",
        width: SIZE * CELL + 66,
        maxWidth: "100%",
        background: C.paper,
        borderRadius: 18,
        padding: 30,
        boxSizing: "border-box",
        fontFamily: FONT,
        color: C.ink,
        boxShadow: "0 18px 44px rgba(96, 84, 60, .16)"
      }
    },
    React.createElement("div", {
      style: {
        position: "absolute",
        top: 22,
        right: 22,
        width: 58,
        height: 58,
        borderRadius: "50%",
        border: "1px solid rgba(138,154,132,.45)",
        pointerEvents: "none"
      }
    }),
    React.createElement("div", {
      style: {
        position: "absolute",
        top: 32,
        right: 32,
        width: 13,
        height: 13,
        borderRadius: "50%",
        background: "rgba(138,154,132,.5)",
        pointerEvents: "none"
      }
    }),
    React.createElement("div", {
      style: {
        position: "absolute",
        bottom: 24,
        left: 24,
        width: 9,
        height: 9,
        borderRadius: "50%",
        background: C.mist,
        pointerEvents: "none"
      }
    }),
    React.createElement(
      "header",
      { style: { padding: "2px 0 20px" } },
      React.createElement(
        "div",
        {
          style: {
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.36em",
            textTransform: "uppercase",
            color: C.sub
          }
        },
        "Gomoku \xB7 Nordic"
      ),
      React.createElement(
        "h2",
        {
          style: {
            margin: "12px 0 0",
            fontSize: 30,
            fontWeight: 300,
            letterSpacing: "0.1em",
            lineHeight: 1,
            color: C.ink
          }
        },
        "\u4E94\u5B50\u68CB"
      ),
      React.createElement(
        "div",
        { style: { marginTop: 16, display: "flex", alignItems: "center", gap: 10 } },
        React.createElement("span", {
          style: {
            width: 11,
            height: 11,
            borderRadius: "50%",
            flexShrink: 0,
            background: over ? winner ? C.sage : "#b9b2a4" : current === 1 ? "#3b3932" : "#f0e9d6",
            border: "1px solid rgba(70,66,58,.4)",
            boxShadow: "0 1px 3px rgba(96,82,56,.25)"
          }
        }),
        React.createElement(
          "span",
          { style: { fontSize: 13, letterSpacing: "0.08em", color: C.sub } },
          status
        )
      ),
      React.createElement("div", {
        style: {
          marginTop: 18,
          height: 1,
          background: "linear-gradient(90deg, rgba(138,154,132,.55), rgba(138,154,132,0))"
        }
      })
    ),
    React.createElement(
      "div",
      {
        style: {
          position: "relative",
          width: SIZE * CELL + 2,
          height: SIZE * CELL + 2,
          margin: "0 auto",
          background: boardBg,
          border: "1px solid " + C.line,
          borderRadius: 10,
          boxShadow: "inset 0 2px 10px rgba(88, 70, 44, .16), 0 10px 22px rgba(96, 82, 56, .2)",
          userSelect: "none"
        }
      },
      cells
    ),
    React.createElement(
      "footer",
      { style: { display: "flex", justifyContent: "center", gap: 14, padding: "24px 0 2px" } },
      React.createElement(NordicButton, { onClick: undo, disabled: !history.length || over }, "\u6094\u68CB"),
      React.createElement(NordicButton, { onClick: reset }, "\u91CD\u5F00")
    )
  );
}
function apply(ctx) {
  ctx.slots.place("plugin-store-extras", NordicCard, { key: "gomoku-nordic", order: 10 });
}
export {
  apply,
  inject,
  name
};
