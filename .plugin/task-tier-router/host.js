// tiers.ts
var PLAN_PERSONA = [
  "\u4F60\u662F\u5206\u5C42 workflow \u7684\u3010\u89C4\u5212\u5C42\u3011\uFF0C\u4F7F\u7528 Claude\u3002",
  "\u804C\u8D23\uFF1A\u628A\u7528\u6237\u76EE\u6807\u62C6\u6210\u53EF\u72EC\u7ACB\u6267\u884C\u7684\u5B50\u4EFB\u52A1\uFF0C\u53EA\u505A\u89C4\u5212\u4E0D\u505A\u6267\u884C\u3002",
  "\u8F93\u51FA\u4E25\u683C\u7528 JSON\uFF0C\u4E0D\u8981 markdown \u4EE3\u7801\u56F4\u680F\uFF0C\u4E0D\u8981\u989D\u5916\u89E3\u91CA\uFF1A",
  '{"goal":"\u4E00\u53E5\u8BDD\u76EE\u6807","subtasks":[{"title":"\u5B50\u4EFB\u52A1\u6807\u9898","detail":"\u8981\u505A\u4EC0\u4E48\u3001\u9A8C\u6536\u6807\u51C6","difficulty":"low|med|high"}],"risks":["\u98CE\u9669\u70B9"]}',
  "subtasks \u63A7\u5236\u5728 2~4 \u6761\uFF0C\u5F7C\u6B64\u5C3D\u91CF\u72EC\u7ACB\u4EE5\u4FBF\u5E76\u884C\u3002"
].join("\n");
var COORD_PERSONA = [
  "\u4F60\u662F\u5206\u5C42 workflow \u7684\u3010\u7EDF\u7B79\u5C42\u3011\uFF0C\u4F7F\u7528 GPT\u3002",
  "\u804C\u8D23\uFF1A\u628A\u89C4\u5212\u5C42\u7684\u5B50\u4EFB\u52A1\u5206\u6D3E\u7ED9\u6267\u884C\u5C42 worker\uFF0C\u5E76\u5728\u6267\u884C\u5B8C\u6210\u540E\u9A8C\u6536\u3001\u6574\u5408\u3002",
  "\u5206\u6D3E\u9636\u6BB5\u8F93\u51FA\u4E25\u683C JSON\uFF0C\u4E0D\u8981 markdown \u4EE3\u7801\u56F4\u680F\uFF1A",
  '{"assignments":[{"index":0,"slot":"kimi|deepseek","brief":"\u7ED9\u8BE5 worker \u7684\u6267\u884C\u6307\u4EE4"}]}',
  "slot \u53EA\u80FD\u662F kimi \u6216 deepseek\uFF0Cindex \u662F\u5B50\u4EFB\u52A1\u4E0B\u6807\u3002\u5C3D\u91CF\u8BA9\u4E24\u4E2A worker \u8D1F\u8F7D\u5747\u8861\u3002",
  "\u9A8C\u6536\u9636\u6BB5\u6309\u8981\u6C42\u8F93\u51FA\u4E2D\u6587\u62A5\u544A\uFF0C\u4E0D\u9700\u8981 JSON\u3002"
].join("\n");
function execPersona(label) {
  return [
    `\u4F60\u662F\u5206\u5C42 workflow \u7684\u3010\u6267\u884C\u5C42\u3011worker\uFF08${label}\uFF09\u3002`,
    "\u804C\u8D23\uFF1A\u6309\u7EDF\u7B79\u5C42\u7ED9\u7684\u6307\u4EE4\u76F4\u63A5\u4EA7\u51FA\u7ED3\u679C\uFF0C\u4E0D\u8981\u518D\u5F80\u4E0B\u6D3E\u5DE5\u3002",
    "\u8981\u6C42\uFF1A\u8F93\u51FA\u53EF\u76F4\u63A5\u4F7F\u7528\u7684\u6210\u54C1\u5185\u5BB9\uFF0C\u7B80\u6D01\u3001\u65E0\u5BD2\u6684\u3001\u4E0D\u8981\u590D\u8FF0\u6307\u4EE4\u3002"
  ].join("\n");
}
var TIERS = [
  {
    tier: "plan",
    slot: "claude",
    label: "Claude \u89C4\u5212",
    provider: "openai",
    model: "claude-sonnet-4-6",
    persona: PLAN_PERSONA
  },
  {
    tier: "coord",
    slot: "gpt",
    label: "GPT \u7EDF\u7B79",
    provider: "openai",
    model: "gpt-5.1",
    persona: COORD_PERSONA
  },
  {
    tier: "exec",
    slot: "kimi",
    label: "Kimi \u6267\u884C",
    provider: "openai",
    model: "kimi-k3",
    persona: execPersona("Kimi")
  },
  {
    tier: "exec",
    slot: "deepseek",
    label: "DeepSeek \u6267\u884C",
    provider: "openai",
    model: "deepseek-v3.2",
    persona: execPersona("DeepSeek")
  }
];
function execSlots() {
  return TIERS.filter((t) => t.tier === "exec");
}
function planTier() {
  return TIERS.find((t) => t.tier === "plan");
}
function coordTier() {
  return TIERS.find((t) => t.tier === "coord");
}
function sessionTitle(def, runLabel) {
  return `[${def.tier}] ${def.label} \xB7 ${runLabel}`;
}

// parse.ts
function extractJson(text) {
  const cleaned = text.replace(/```json/gi, "```").trim();
  const fenced = cleaned.match(/```\s*([\s\S]*?)```/);
  const candidates = [];
  if (fenced?.[1]) candidates.push(fenced[1].trim());
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) candidates.push(cleaned.slice(start, end + 1));
  candidates.push(cleaned);
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      continue;
    }
  }
  return null;
}
function asDifficulty(value) {
  return value === "low" || value === "high" ? value : "med";
}
function parsePlan(text, fallbackGoal) {
  const raw = text;
  const data = extractJson(text);
  const subtasksRaw = Array.isArray(data?.subtasks) ? data.subtasks : [];
  const subtasks = subtasksRaw.map((item) => {
    const row = item ?? {};
    const title = String(row.title ?? "").trim();
    if (!title) return null;
    return {
      title: title.slice(0, 120),
      detail: String(row.detail ?? "").trim(),
      difficulty: asDifficulty(row.difficulty)
    };
  }).filter((item) => item !== null).slice(0, 6);
  if (!subtasks.length) {
    return {
      goal: fallbackGoal,
      subtasks: [{ title: fallbackGoal.slice(0, 120), detail: raw.slice(0, 2e3), difficulty: "med" }],
      risks: [],
      degraded: true,
      raw
    };
  }
  const risks = Array.isArray(data?.risks) ? data.risks.map((r) => String(r).trim()).filter(Boolean).slice(0, 8) : [];
  return {
    goal: String(data?.goal ?? "").trim() || fallbackGoal,
    subtasks,
    risks,
    degraded: false,
    raw
  };
}
function parseAssignments(text, subtaskCount, slots) {
  const data = extractJson(text);
  const rows = Array.isArray(data?.assignments) ? data.assignments : [];
  const bySlot = /* @__PURE__ */ new Map();
  for (const item of rows) {
    const row = item ?? {};
    const index = Number(row.index);
    if (!Number.isInteger(index) || index < 0 || index >= subtaskCount) continue;
    const slot = slots.includes(String(row.slot)) ? String(row.slot) : slots[index % slots.length];
    bySlot.set(index, {
      index,
      slot,
      brief: String(row.brief ?? "").trim()
    });
  }
  const degraded = bySlot.size < subtaskCount;
  for (let i = 0; i < subtaskCount; i += 1) {
    if (bySlot.has(i)) continue;
    bySlot.set(i, { index: i, slot: slots[i % slots.length], brief: "" });
  }
  return {
    assignments: [...bySlot.values()].sort((a, b) => a.index - b.index),
    degraded
  };
}

// workers.ts
async function ensureWorker(host, def, runLabel, opts) {
  const cached = opts.pool.get(def.slot);
  if (cached) {
    const alive = host.sessions.peek(cached) ?? await host.sessions.get(cached);
    if (alive) return makeHandle(host, def, cached);
  }
  const record = await host.sessions.create(void 0, {
    type: "chat",
    title: sessionTitle(def, runLabel),
    config: {
      provider: def.provider,
      model: def.model,
      systemPrompt: def.persona,
      // 执行层需要动手的能力，统一给 standard；规划/统筹只出文本也用 standard，
      // 保持一致以免 minimal 模式下工具缺失导致行为不一致。
      agentMode: "standard",
      tags: ["tier-router", def.tier]
    }
  });
  await host.sessions.patchConfig(record.id, {
    provider: def.provider,
    model: def.model,
    systemPrompt: def.persona
  });
  if (opts.project) {
    try {
      await host.sessions.setProject(record.id, { path: opts.project });
    } catch (error) {
      host.logger("tier-router").error(`bind project failed slot=${def.slot}: ${String(error)}`);
    }
  }
  opts.pool.set(def.slot, record.id);
  return makeHandle(host, def, record.id);
}
function makeHandle(host, def, sessionId) {
  return {
    def,
    sessionId,
    ask: async (prompt) => {
      const agent = await host.agents.create(sessionId);
      const turn = await agent.send(prompt, { wait: true });
      return String(turn.text ?? "").trim();
    }
  };
}
function effectiveModel(host, sessionId) {
  const peek = host.sessions.peek(sessionId);
  return peek?.config?.model ?? "(unknown)";
}

// flow.ts
function runLabelOf(goal) {
  const stamp = (/* @__PURE__ */ new Date()).toISOString().slice(11, 19);
  return `${goal.slice(0, 18)}@${stamp}`;
}
async function timed(fn) {
  const started = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - started };
}
function trace(worker, host, ms, text) {
  return {
    tier: worker.def.tier,
    slot: worker.def.slot,
    model: effectiveModel(host, worker.sessionId) || worker.def.model,
    sessionId: worker.sessionId,
    ms,
    chars: text.length
  };
}
async function runTieredFlow(host, input) {
  const goal = input.goal.trim();
  if (!goal) throw new Error("goal required");
  const startedAll = Date.now();
  const runLabel = runLabelOf(goal);
  const pool = /* @__PURE__ */ new Map();
  const traces = [];
  const degraded = [];
  const log = host.logger("tier-router");
  const wanted = { project: input.project, pool };
  const root = host.tasks.create({
    title: `\u5206\u5C42\u6267\u884C\uFF1A${goal.slice(0, 60)}`,
    description: goal,
    status: "doing",
    priority: "high",
    project: "tier-router",
    tags: ["tier-router", "workflow"],
    creator: { kind: "agent", name: "tier-router" }
  });
  const planner = await ensureWorker(host, planTier(), runLabel, wanted);
  const planRun = await timed(
    () => planner.ask(
      [
        `\u76EE\u6807\uFF1A${goal}`,
        input.project ? `\u5DE5\u4F5C\u76EE\u5F55\uFF1A${input.project}` : "",
        "\u8BF7\u6309\u4F60\u7684 JSON \u89C4\u8303\u8F93\u51FA\u62C6\u89E3\u65B9\u6848\u3002"
      ].filter(Boolean).join("\n")
    )
  );
  traces.push(trace(planner, host, planRun.ms, planRun.value));
  const plan = parsePlan(planRun.value, goal);
  if (plan.degraded) degraded.push("\u89C4\u5212\u5C42\u672A\u8FD4\u56DE\u53EF\u89E3\u6790 JSON\uFF0C\u5DF2\u964D\u7EA7\u4E3A\u5355\u5B50\u4EFB\u52A1");
  host.tasks.report(root.id, {
    sessionId: planner.sessionId,
    turn: null,
    status: "doing",
    note: `\u89C4\u5212\u5B8C\u6210\uFF1A${plan.subtasks.length} \u4E2A\u5B50\u4EFB\u52A1\uFF08${effectiveModel(host, planner.sessionId)}\uFF09`,
    ts: Date.now()
  });
  const childTasks = plan.subtasks.map(
    (sub) => host.tasks.create({
      title: sub.title,
      description: sub.detail,
      status: "todo",
      difficulty: sub.difficulty,
      parentId: root.id,
      project: "tier-router",
      tags: ["tier-router", "exec"],
      creator: { kind: "agent", name: "tier-router" }
    })
  );
  const slots = execSlots();
  const coordinator = await ensureWorker(host, coordTier(), runLabel, wanted);
  const dispatchRun = await timed(
    () => coordinator.ask(
      [
        `\u76EE\u6807\uFF1A${plan.goal}`,
        "\u5B50\u4EFB\u52A1\u6E05\u5355\uFF1A",
        ...plan.subtasks.map((s, i) => `${i}. ${s.title} \u2014\u2014 ${s.detail}`),
        `\u53EF\u7528 worker \u69FD\u4F4D\uFF1A${slots.map((s) => `${s.slot}(${s.label})`).join("\u3001")}`,
        "\u8BF7\u8F93\u51FA\u5206\u6D3E JSON\u3002"
      ].join("\n")
    )
  );
  traces.push(trace(coordinator, host, dispatchRun.ms, dispatchRun.value));
  const parsedAssign = parseAssignments(
    dispatchRun.value,
    plan.subtasks.length,
    slots.map((s) => s.slot)
  );
  if (parsedAssign.degraded) degraded.push("\u7EDF\u7B79\u5C42\u5206\u6D3E\u4E0D\u5B8C\u6574\uFF0C\u7F3A\u5931\u9879\u5DF2\u6309 round-robin \u8865\u9F50");
  const execWorkers = /* @__PURE__ */ new Map();
  for (const def of slots) {
    execWorkers.set(def.slot, await ensureWorker(host, def, runLabel, wanted));
  }
  for (const item of parsedAssign.assignments) {
    const worker = execWorkers.get(item.slot);
    const task = childTasks[item.index];
    if (!worker || !task) continue;
    host.tasks.update(task.id, {
      assignee: { kind: "agent", name: worker.def.label, sessionId: worker.sessionId },
      assignedAt: Date.now(),
      notes: item.brief
    });
  }
  if (input.dryRun) {
    host.tasks.report(root.id, {
      sessionId: coordinator.sessionId,
      turn: null,
      status: "doing",
      note: "dryRun\uFF1A\u5DF2\u5B8C\u6210\u89C4\u5212\u4E0E\u5206\u6D3E\uFF0C\u672A\u6267\u884C",
      ts: Date.now()
    });
    return {
      goal: plan.goal,
      runLabel,
      rootTaskId: root.id,
      plan,
      trace: traces,
      outcomes: parsedAssign.assignments.map((a) => ({
        index: a.index,
        slot: a.slot,
        title: plan.subtasks[a.index]?.title ?? "",
        taskId: childTasks[a.index]?.id ?? "",
        model: execWorkers.get(a.slot)?.def.model ?? "",
        text: "",
        ms: 0,
        ok: true
      })),
      review: "\uFF08dryRun \u672A\u6267\u884C\uFF09",
      degraded,
      totalMs: Date.now() - startedAll
    };
  }
  const bySlot = /* @__PURE__ */ new Map();
  for (const item of parsedAssign.assignments) {
    const list = bySlot.get(item.slot) ?? [];
    list.push(item);
    bySlot.set(item.slot, list);
  }
  const outcomes = [];
  await Promise.all(
    [...bySlot.entries()].map(async ([slot, items]) => {
      const worker = execWorkers.get(slot);
      if (!worker) return;
      for (const item of items) {
        const sub = plan.subtasks[item.index];
        const task = childTasks[item.index];
        if (!sub || !task) continue;
        host.tasks.update(task.id, { status: "doing" });
        try {
          const run = await timed(
            () => worker.ask(
              [
                `\u603B\u76EE\u6807\uFF1A${plan.goal}`,
                `\u4F60\u7684\u5B50\u4EFB\u52A1\uFF1A${sub.title}`,
                sub.detail ? `\u8981\u6C42\uFF1A${sub.detail}` : "",
                item.brief ? `\u7EDF\u7B79\u5C42\u8865\u5145\uFF1A${item.brief}` : "",
                "\u76F4\u63A5\u7ED9\u51FA\u6210\u54C1\u7ED3\u679C\u3002"
              ].filter(Boolean).join("\n")
            )
          );
          traces.push(trace(worker, host, run.ms, run.value));
          outcomes.push({
            index: item.index,
            slot,
            title: sub.title,
            taskId: task.id,
            model: effectiveModel(host, worker.sessionId) || worker.def.model,
            text: run.value,
            ms: run.ms,
            ok: true
          });
          host.tasks.report(task.id, {
            sessionId: worker.sessionId,
            turn: null,
            status: "done",
            note: `${worker.def.label} \u5B8C\u6210\uFF08${run.value.length} \u5B57\uFF09`,
            ts: Date.now()
          });
          host.tasks.update(task.id, { status: "done" });
        } catch (error) {
          const detail = String(error);
          log.error(`exec failed slot=${slot} index=${item.index}: ${detail}`);
          degraded.push(`\u6267\u884C\u5C42 ${slot} \u5B50\u4EFB\u52A1#${item.index} \u5931\u8D25\uFF1A${detail}`);
          outcomes.push({
            index: item.index,
            slot,
            title: sub.title,
            taskId: task.id,
            model: worker.def.model,
            text: "",
            ms: 0,
            ok: false,
            error: detail
          });
          host.tasks.report(task.id, {
            sessionId: worker.sessionId,
            turn: null,
            status: "doing",
            note: `\u6267\u884C\u5931\u8D25\uFF1A${detail.slice(0, 200)}`,
            ts: Date.now()
          });
        }
      }
    })
  );
  outcomes.sort((a, b) => a.index - b.index);
  const reviewRun = await timed(
    () => coordinator.ask(
      [
        `\u76EE\u6807\uFF1A${plan.goal}`,
        "\u5404 worker \u4EA4\u4ED8\u5982\u4E0B\uFF0C\u8BF7\u9A8C\u6536\u5E76\u6574\u5408\u6210\u4E00\u4EFD\u6700\u7EC8\u7ED3\u679C\u3002",
        ...outcomes.map(
          (o) => `\u3010\u5B50\u4EFB\u52A1${o.index}\xB7${o.slot}\xB7${o.model}\u3011${o.title}
${o.ok ? o.text.slice(0, 4e3) : `\uFF08\u5931\u8D25\uFF1A${o.error}\uFF09`}`
        ),
        "\u8F93\u51FA\u683C\u5F0F\uFF1A\u4E00\u3001\u6574\u5408\u7ED3\u679C\uFF08\u53EF\u76F4\u63A5\u4EA4\u4ED8\u7684\u5185\u5BB9\uFF09\uFF1B\u4E8C\u3001\u9A8C\u6536\u610F\u89C1\uFF08\u6BCF\u6761\u5B50\u4EFB\u52A1\u4E00\u53E5\uFF0C\u6307\u51FA\u95EE\u9898\u6216\u786E\u8BA4\u901A\u8FC7\uFF09\uFF1B\u4E09\u3001\u82E5\u6709\u7F3A\u53E3\u5217\u51FA\u8865\u6551\u5EFA\u8BAE\u3002"
      ].join("\n\n")
    )
  );
  traces.push(trace(coordinator, host, reviewRun.ms, reviewRun.value));
  const allOk = outcomes.every((o) => o.ok);
  host.tasks.report(root.id, {
    sessionId: coordinator.sessionId,
    turn: null,
    status: allOk ? "done" : "doing",
    note: allOk ? `\u7EDF\u7B79\u9A8C\u6536\u5B8C\u6210\uFF0C${outcomes.length} \u6761\u5B50\u4EFB\u52A1\u5168\u90E8\u4EA4\u4ED8` : `\u7EDF\u7B79\u9A8C\u6536\u5B8C\u6210\uFF0C\u5B58\u5728\u5931\u8D25\u5B50\u4EFB\u52A1\uFF08${outcomes.filter((o) => !o.ok).length} \u6761\uFF09`,
    ts: Date.now()
  });
  host.tasks.update(root.id, { status: allOk ? "done" : "doing" });
  return {
    goal: plan.goal,
    runLabel,
    rootTaskId: root.id,
    plan,
    trace: traces,
    outcomes,
    review: reviewRun.value,
    degraded,
    totalMs: Date.now() - startedAll
  };
}

// host.ts
var name = "task-tier-router";
var inject = ["tools", "sessions", "agents", "tasks"];
function renderReport(result) {
  const lines = [];
  lines.push(`\u76EE\u6807\uFF1A${result.goal}`);
  lines.push(`\u6839\u4EFB\u52A1\uFF1A${result.rootTaskId} \xB7 \u603B\u8017\u65F6 ${(result.totalMs / 1e3).toFixed(1)}s`);
  lines.push("");
  lines.push("\u5C42\u7EA7\u8C03\u7528\u8F68\u8FF9\uFF1A");
  lines.push("| \u5C42\u7EA7 | \u69FD\u4F4D | \u6A21\u578B | \u8017\u65F6 | \u8F93\u51FA\u5B57\u6570 |");
  lines.push("|---|---|---|---|---|");
  for (const t of result.trace) {
    lines.push(`| ${t.tier} | ${t.slot} | ${t.model} | ${(t.ms / 1e3).toFixed(1)}s | ${t.chars} |`);
  }
  lines.push("");
  lines.push(`\u89C4\u5212\u5C42\u62C6\u51FA ${result.plan.subtasks.length} \u6761\u5B50\u4EFB\u52A1\uFF1A`);
  for (const [i, sub] of result.plan.subtasks.entries()) {
    const outcome = result.outcomes.find((o) => o.index === i);
    const who = outcome ? `${outcome.slot}/${outcome.model}` : "\u672A\u5206\u6D3E";
    lines.push(`${i}. ${sub.title} \u2192 ${who}${outcome && !outcome.ok ? " \u274C" : ""}`);
  }
  if (result.plan.risks.length) {
    lines.push("");
    lines.push(`\u89C4\u5212\u5C42\u63D0\u793A\u98CE\u9669\uFF1A${result.plan.risks.join("\uFF1B")}`);
  }
  if (result.degraded.length) {
    lines.push("");
    lines.push("\u964D\u7EA7\u8BB0\u5F55\uFF1A");
    for (const d of result.degraded) lines.push(`- ${d}`);
  }
  lines.push("");
  lines.push("\u7EDF\u7B79\u5C42\u9A8C\u6536\u4E0E\u6574\u5408\uFF1A");
  lines.push(result.review);
  return lines.join("\n");
}
function apply(ctx) {
  ctx.tools.register({
    name: "tier_flow_run",
    description: "\u5206\u5C42 workflow\uFF1A\u63A5\u5230\u76EE\u6807\u540E Claude \u89C4\u5212\u62C6\u89E3 \u2192 GPT \u7EDF\u7B79\u5206\u6D3E \u2192 Kimi/DeepSeek \u5E76\u884C\u6267\u884C \u2192 GPT \u9A8C\u6536\u6574\u5408\u3002\u6BCF\u5C42\u8DD1\u5404\u81EA\u6A21\u578B\uFF0C\u5168\u8FC7\u7A0B\u843D\u4EFB\u52A1\u9762\u677F\uFF08\u6839\u4EFB\u52A1+\u5B50\u4EFB\u52A1+report\uFF09\u3002\u8FD4\u56DE\u5404\u5C42\u8C03\u7528\u8F68\u8FF9\u4E0E\u6700\u7EC8\u6574\u5408\u7ED3\u679C\u3002",
    parameters: {
      type: "object",
      properties: {
        goal: { type: "string", description: "\u8981\u4EA4\u4ED8\u7684\u76EE\u6807\uFF0C\u4E00\u53E5\u8BDD\u63CF\u8FF0" },
        project: { type: "string", description: "\u53EF\u9009\uFF1A\u7ED9\u5404\u5C42 session \u7ED1\u5B9A\u7684\u5DE5\u4F5C\u76EE\u5F55\u7EDD\u5BF9\u8DEF\u5F84" },
        dryRun: { type: "boolean", description: "\u53EA\u505A\u89C4\u5212\u4E0E\u5206\u6D3E\u9884\u89C8\uFF0C\u4E0D\u771F\u6B63\u6267\u884C" },
        format: {
          type: "string",
          enum: ["report", "json"],
          description: "report=\u53EF\u8BFB\u62A5\u544A\uFF08\u9ED8\u8BA4\uFF09\uFF1Bjson=\u539F\u59CB\u7ED3\u6784"
        }
      },
      required: ["goal"]
    },
    execute: async (args) => {
      const result = await runTieredFlow(ctx, {
        goal: String(args.goal ?? ""),
        ...typeof args.project === "string" && args.project.trim() ? { project: args.project.trim() } : {},
        dryRun: args.dryRun === true
      });
      if (args.format === "json") return result;
      return {
        rootTaskId: result.rootTaskId,
        totalMs: result.totalMs,
        report: renderReport(result),
        sessions: result.trace.map((t) => ({
          tier: t.tier,
          slot: t.slot,
          model: t.model,
          sessionId: t.sessionId
        }))
      };
    }
  });
  ctx.tools.register({
    name: "tier_flow_tiers",
    description: "\u67E5\u770B\u5206\u5C42 workflow \u7684\u5C42\u7EA7 \u2192 \u6A21\u578B\u6620\u5C04\uFF08\u89C4\u5212/\u7EDF\u7B79/\u6267\u884C\u5404\u7528\u54EA\u4E2A\u6A21\u578B\uFF09\u3002",
    parameters: { type: "object", properties: {} },
    execute: () => ({
      tiers: TIERS.map((t) => ({
        tier: t.tier,
        slot: t.slot,
        label: t.label,
        provider: t.provider,
        model: t.model
      })),
      note: "\u6A21\u578B\u6309 session.config \u8986\u76D6\u751F\u6548\uFF1B\u6539\u6620\u5C04\u8BF7\u7F16\u8F91\u63D2\u4EF6 tiers.ts \u540E\u91CD\u65B0 plugin_pack\u3002"
    })
  });
}
export {
  apply,
  inject,
  name
};
