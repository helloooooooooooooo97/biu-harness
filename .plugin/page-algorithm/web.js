const React = globalThis.React
// web.tsx
var name = "page-algorithm";
var inject = ["pageEditor", "slots"];
var DEFAULTS = {
  title: "1. Two Sum",
  difficulty: "Easy",
  prompt: "\u7ED9\u5B9A\u4E00\u4E2A\u6574\u6570\u6570\u7EC4 nums \u548C\u4E00\u4E2A\u6574\u6570\u76EE\u6807\u503C target\uFF0C\u8BF7\u4F60\u5728\u8BE5\u6570\u7EC4\u4E2D\u627E\u51FA\u548C\u4E3A\u76EE\u6807\u503C\u7684\u90A3\u4E24\u4E2A\u6574\u6570\uFF0C\u5E76\u8FD4\u56DE\u5B83\u4EEC\u7684\u6570\u7EC4\u4E0B\u6807\u3002\n\n\u4F60\u53EF\u4EE5\u5047\u8BBE\u6BCF\u79CD\u8F93\u5165\u53EA\u4F1A\u5BF9\u5E94\u4E00\u4E2A\u7B54\u6848\u3002\u6570\u7EC4\u4E2D\u540C\u4E00\u4E2A\u5143\u7D20\u5728\u7B54\u6848\u91CC\u4E0D\u80FD\u91CD\u590D\u51FA\u73B0\u3002",
  lang: "python",
  code: `class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        seen = {}
        for i, n in enumerate(nums):
            if target - n in seen:
                return [seen[target - n], i]
            seen[n] = i
        return []`
};
var DIFF_COLOR = {
  Easy: "#00b8a3",
  Medium: "#ffc01e",
  Hard: "#ff375f"
};
function AlgorithmCard({
  data,
  update,
  writable
}) {
  const title = String(data.title ?? "");
  const difficulty = String(data.difficulty ?? "Easy");
  const prompt = String(data.prompt ?? "");
  const lang = String(data.lang ?? "python");
  const code = String(data.code ?? "");
  const accent = DIFF_COLOR[difficulty] ?? "#00b8a3";
  const ro = !writable;
  const field = {
    width: "100%",
    boxSizing: "border-box",
    border: "none",
    outline: "none",
    background: "transparent",
    color: "inherit",
    font: "inherit",
    resize: "vertical"
  };
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      "data-testid": "page-algorithm-card",
      style: {
        display: "flex",
        flexWrap: "wrap",
        minHeight: 280,
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid #30363d",
        background: "#1e1e1e",
        color: "#e6edf3",
        font: "13px/1.5 ui-sans-serif, system-ui, sans-serif"
      }
    },
    /* @__PURE__ */ React.createElement(
      "section",
      {
        style: {
          flex: "1 1 240px",
          minWidth: 220,
          maxWidth: "50%",
          padding: "14px 16px 16px",
          background: "#262626",
          borderRight: "1px solid #30363d"
        }
      },
      /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", opacity: 0.55 } }, "DESCRIPTION"), /* @__PURE__ */ React.createElement(
        "select",
        {
          "data-testid": "page-algorithm-diff",
          disabled: ro,
          value: difficulty,
          onChange: (event) => update({ difficulty: event.target.value }),
          style: {
            marginLeft: "auto",
            border: "none",
            borderRadius: 999,
            padding: "2px 8px",
            background: "transparent",
            color: accent,
            fontWeight: 700,
            fontSize: 12
          }
        },
        /* @__PURE__ */ React.createElement("option", null, "Easy"),
        /* @__PURE__ */ React.createElement("option", null, "Medium"),
        /* @__PURE__ */ React.createElement("option", null, "Hard")
      )),
      /* @__PURE__ */ React.createElement(
        "input",
        {
          "data-testid": "page-algorithm-title",
          readOnly: ro,
          value: title,
          onChange: (event) => update({ title: event.target.value }),
          style: { ...field, fontSize: 18, fontWeight: 700, marginBottom: 10 }
        }
      ),
      /* @__PURE__ */ React.createElement(
        "textarea",
        {
          "data-testid": "page-algorithm-prompt",
          readOnly: ro,
          value: prompt,
          onChange: (event) => update({ prompt: event.target.value }),
          style: { ...field, minHeight: 160 }
        }
      )
    ),
    /* @__PURE__ */ React.createElement("section", { style: { flex: "1 1 260px", minWidth: 240, display: "flex", flexDirection: "column", background: "#1e1e1e" } }, /* @__PURE__ */ React.createElement(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          borderBottom: "1px solid #30363d",
          fontSize: 12
        }
      },
      /* @__PURE__ */ React.createElement("span", { style: { opacity: 0.55, fontWeight: 700 } }, "Code"),
      /* @__PURE__ */ React.createElement(
        "select",
        {
          "data-testid": "page-algorithm-lang",
          disabled: ro,
          value: lang,
          onChange: (event) => update({ lang: event.target.value }),
          style: { marginLeft: "auto", background: "#262626", color: "inherit", border: "1px solid #30363d", borderRadius: 6, padding: "2px 8px" }
        },
        /* @__PURE__ */ React.createElement("option", { value: "python" }, "Python"),
        /* @__PURE__ */ React.createElement("option", { value: "javascript" }, "JavaScript"),
        /* @__PURE__ */ React.createElement("option", { value: "typescript" }, "TypeScript"),
        /* @__PURE__ */ React.createElement("option", { value: "java" }, "Java"),
        /* @__PURE__ */ React.createElement("option", { value: "cpp" }, "C++")
      )
    ), /* @__PURE__ */ React.createElement(
      "textarea",
      {
        "data-testid": "page-algorithm-code",
        readOnly: ro,
        spellCheck: false,
        value: code,
        onChange: (event) => update({ code: event.target.value }),
        style: {
          ...field,
          flex: 1,
          minHeight: 200,
          padding: 12,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          fontSize: 12,
          lineHeight: 1.55,
          color: "#d4d4d4"
        }
      }
    ))
  );
}
function Panel() {
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      "data-testid": "page-algorithm-panel",
      style: { boxSizing: "border-box", width: "100%", height: "100%", padding: 16, font: "13px/1.5 ui-sans-serif, system-ui, sans-serif" }
    },
    "\u5728\u9875\u9762\u6B63\u6587\u8F93\u5165 / \u9009\u300C\u7B97\u6CD5\u9898\u300D\uFF0C\u63D2\u5165 LeetCode \u98CE\u5361\u7247\uFF1A\u5DE6\u8FB9\u9898\u76EE\uFF0C\u53F3\u8FB9\u4EE3\u7801\u3002"
  );
}
function Icon(props) {
  const className = props.className ?? "size-5";
  return /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 16 16", fill: "currentColor", className, "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("path", { d: "M3 2h6l4 4v8H3V2Zm6 1.4V6h2.6L9 3.4ZM5 9h6v1H5V9Zm0 2h6v1H5v-1Z" }));
}
function apply(ctx) {
  ctx.pageEditor.registerBlock({
    kind: "algorithm",
    label: "\u7B97\u6CD5\u9898",
    hint: "LeetCode \u98CE\uFF1A\u5DE6\u9898\u76EE\u53F3\u4EE3\u7801",
    aliases: ["leetcode", "algo", "\u7B97\u6CD5", "lc"],
    defaults: DEFAULTS,
    View: AlgorithmCard
  });
  ctx.slots.place("plugin-store-extras", Panel, {
    key: "page-algorithm",
    props: () => ({ Icon })
  });
}
export {
  apply,
  inject,
  name
};
