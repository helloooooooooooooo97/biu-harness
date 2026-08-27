const React = globalThis.React
const { useState, useCallback } = React
const name = "store-gomoku";
const inject = ["slots"];
const SIZE = 16;
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
const stoneStyle = (player) => ({
  width: 20,
  height: 20,
  borderRadius: "50%",
  background: player === 1 ? "#111" : "#f5f5f5",
  boxShadow: player ? "inset 0 -2px 4px rgba(0,0,0,.35), 0 1px 2px rgba(0,0,0,.3)" : "none",
  pointerEvents: player ? "none" : "auto",
  cursor: player ? "default" : "pointer",
  transition: "transform .1s"
});
function GomokuCard() {
  const [board, setBoard] = useState(initBoard);
  const [current, setCurrent] = useState(1);
  const [winner, setWinner] = useState(0);
  const [history, setHistory] = useState([]);
  const handleClick = useCallback((row, col) => {
    if (winner || board[row][col]) return;
    const next = board.map((r) => [...r]);
    next[row][col] = current;
    setBoard(next);
    setHistory([...history, { row, col }]);
    if (checkWin(next, row, col, current)) {
      setWinner(current);
    } else {
      setCurrent(current === 1 ? 2 : 1);
    }
  }, [board, current, winner, history]);
  const undo = useCallback(() => {
    if (!history.length || winner) return;
    const last = history[history.length - 1];
    const next = board.map((r) => [...r]);
    next[last.row][last.col] = 0;
    setBoard(next);
    setHistory(history.slice(0, -1));
    setCurrent(last.player || current === 1 ? 2 : 1);
    setCurrent(history.length % 2 === 1 ? 1 : 2);
  }, [board, history, winner, current]);
  const reset = useCallback(() => {
    setBoard(initBoard());
    setCurrent(1);
    setWinner(0);
    setHistory([]);
  }, []);
  const status = winner ? `\u{1F389} ${winner === 1 ? "\u9ED1\u68CB" : "\u767D\u68CB"} \u83B7\u80DC\uFF01` : `\u8F6E\u5230 ${current === 1 ? "\u9ED1\u68CB \u26AB" : "\u767D\u68CB \u26AA"} \u843D\u5B50`;
  return /* @__PURE__ */ React.createElement("div", {
    style: {
      fontFamily: "system-ui, sans-serif",
      padding: 16,
      borderRadius: 12,
      border: "1px solid #e5e7eb",
      background: "#fff",
      display: "inline-flex",
      flexDirection: "column",
      gap: 12,
      maxWidth: "100%"
    }
  }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 } }, /* @__PURE__ */ React.createElement("strong", { style: { fontSize: 16 } }, "\u4E94\u5B50\u68CB"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: 13, color: winner ? "#b45309" : "#6b7280" } }, status)), /* @__PURE__ */ React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: `repeat(${SIZE}, 24px)`,
      gridTemplateRows: `repeat(${SIZE}, 24px)`,
      background: "#dcb35c",
      border: "4px solid #a97e3a",
      borderRadius: 6,
      userSelect: "none"
    }
  }, board.map(
    (rowArr, r) => rowArr.map((v, c) => /* @__PURE__ */ React.createElement(
      "div",
      {
        key: `${r}-${c}`,
        onClick: () => handleClick(r, c),
        style: {
          width: 24,
          height: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,.08)",
          ...stoneStyle(v)
        }
      }
    ))
  )), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: 8 } }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: undo,
      disabled: !history.length || !!winner,
      style: btnStyle
    },
    "\u21BA \u6094\u68CB"
  ), /* @__PURE__ */ React.createElement("button", { onClick: reset, style: btnStyle }, "\u{1F504} \u91CD\u5F00")));
}
const btnStyle = {
  flex: 1,
  padding: "6px 0",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  background: "#f9fafb",
  cursor: "pointer",
  fontSize: 13
};
function apply(ctx) {
  ctx.slots.place("plugin-store-extras", GomokuCard, { key: "store-gomoku", order: 10 });
}
export {
  apply,
  inject,
  name
};
