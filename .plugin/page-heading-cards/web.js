const React = globalThis.React
// web.tsx
var name = "page-heading-cards";
var inject = ["pageEditor", "slots"];
function card(level, accent) {
  return function HeadingCard({ children }) {
    return /* @__PURE__ */ React.createElement(
      "span",
      {
        "data-testid": `page-heading-card-${level}`,
        style: {
          display: "flex",
          flexDirection: "column",
          gap: 2,
          borderLeft: `4px solid ${accent}`,
          padding: "8px 12px",
          margin: "2px 0",
          background: `color-mix(in srgb, ${accent} 14%, transparent)`,
          borderRadius: 8
        }
      },
      /* @__PURE__ */ React.createElement("span", { contentEditable: false, style: { fontSize: 11, fontWeight: 700, opacity: 0.55, letterSpacing: "0.06em" } }, `H${level}`),
      children
    );
  };
}
function Panel() {
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      "data-testid": "page-heading-cards-panel",
      style: {
        boxSizing: "border-box",
        width: "100%",
        height: "100%",
        padding: 16,
        font: "13px/1.5 ui-sans-serif, system-ui, sans-serif"
      }
    },
    "\u5DF2\u66FF\u6362\u9875\u9762\u6B63\u6587\u7684 H1 / H2 / H3\u3002\u5728\u9875\u9762\u91CC\u8F93\u5165 / \u63D2\u5165\u6807\u9898\u5373\u53EF\u770B\u5230\u5361\u7247\u6837\u5F0F\u3002\u5173\u6389\u672C\u63D2\u4EF6\u540E\u6062\u590D\u539F\u751F\u6807\u9898\u3002"
  );
}
function Icon(props) {
  const className = props.className ?? "size-5";
  return /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 16 16", fill: "currentColor", className, "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("path", { d: "M3 3h10v2H3V3Zm0 4h7v2H3V7Zm0 4h10v2H3v-2Z" }));
}
function apply(ctx) {
  ctx.pageEditor.replaceHeading(1, { View: card(1, "#7c5cfc") });
  ctx.pageEditor.replaceHeading(2, { View: card(2, "#3b82f6") });
  ctx.pageEditor.replaceHeading(3, { View: card(3, "#22c55e") });
  ctx.slots.place("plugin-store-extras", Panel, {
    key: "page-heading-cards",
    props: () => ({ Icon })
  });
}
export {
  apply,
  inject,
  name
};
