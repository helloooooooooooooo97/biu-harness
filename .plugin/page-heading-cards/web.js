const React = globalThis.React
// web.tsx
var name = "page-heading-cards";
var inject = ["pageEditor", "slots"];
function card(level, accent) {
  return {
    label: `H${level}`,
    className: "page-heading-card",
    style: [
      `border-left:4px solid ${accent}`,
      "padding:8px 12px",
      "margin:2px 0",
      `background:color-mix(in srgb, ${accent} 14%, transparent)`
    ].join(";")
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
    "\u5DF2\u7ED9\u9875\u9762 H1 / H2 / H3 \u5957\u4E0A\u5361\u7247\u76AE\u80A4\u3002\u6807\u9898\u4ECD\u662F\u539F\u751F heading\uFF0C\u65B9\u5411\u952E\u53EF\u4EE5\u4E0A\u4E0B\u79FB\u52A8\u3002\u5173\u6389\u672C\u63D2\u4EF6\u540E\u6062\u590D\u9ED8\u8BA4\u6837\u5F0F\u3002"
  );
}
function Icon(props) {
  const className = props.className ?? "size-5";
  return /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 16 16", fill: "currentColor", className, "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("path", { d: "M3 3h10v2H3V3Zm0 4h7v2H3V7Zm0 4h10v2H3v-2Z" }));
}
function apply(ctx) {
  ctx.pageEditor.replaceHeading(1, card(1, "#7c5cfc"));
  ctx.pageEditor.replaceHeading(2, card(2, "#3b82f6"));
  ctx.pageEditor.replaceHeading(3, card(3, "#22c55e"));
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
