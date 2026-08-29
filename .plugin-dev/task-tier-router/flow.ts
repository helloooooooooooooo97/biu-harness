/**
 * 分层 workflow 编排：plan → coord 分派 → exec 并行 → coord 验收整合。
 *
 * 每一步都落到任务面板上（父任务 = 目标，子任务 = 规划出的 subtask），
 * 并用 task_report 的同一套语义写进度，所以整条链在任务面板里可回溯。
 */

import { coordTier, execSlots, planTier, type TierDef } from './tiers.ts'
import { parseAssignments, parsePlan, type PlanResult } from './parse.ts'
import { effectiveModel, ensureWorker, type HostLike, type WorkerHandle } from './workers.ts'

export interface TaskRowLike {
  id: string
  title: string
}

export interface TasksLike {
  create(input: Record<string, unknown>): TaskRowLike
  update(id: string, patch: Record<string, unknown>): TaskRowLike
  report(id: string, report: Record<string, unknown>): TaskRowLike
}

export interface FlowHost extends HostLike {
  tasks: TasksLike
}

export interface RunInput {
  goal: string
  project?: string
  /** 只跑规划+分派，不真正执行（用来预览编排结果） */
  dryRun?: boolean
}

export interface StepTrace {
  tier: string
  slot: string
  model: string
  sessionId: string
  ms: number
  chars: number
}

export interface ExecOutcome {
  index: number
  slot: string
  title: string
  taskId: string
  model: string
  text: string
  ms: number
  ok: boolean
  error?: string
}

export interface RunResult {
  goal: string
  runLabel: string
  rootTaskId: string
  plan: PlanResult
  trace: StepTrace[]
  outcomes: ExecOutcome[]
  review: string
  degraded: string[]
  totalMs: number
}

function runLabelOf(goal: string): string {
  const stamp = new Date().toISOString().slice(11, 19)
  return `${goal.slice(0, 18)}@${stamp}`
}

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const started = Date.now()
  const value = await fn()
  return { value, ms: Date.now() - started }
}

function trace(worker: WorkerHandle, host: FlowHost, ms: number, text: string): StepTrace {
  return {
    tier: worker.def.tier,
    slot: worker.def.slot,
    model: effectiveModel(host, worker.sessionId) || worker.def.model,
    sessionId: worker.sessionId,
    ms,
    chars: text.length,
  }
}

export async function runTieredFlow(host: FlowHost, input: RunInput): Promise<RunResult> {
  const goal = input.goal.trim()
  if (!goal) throw new Error('goal required')
  const startedAll = Date.now()
  const runLabel = runLabelOf(goal)
  const pool = new Map<string, string>()
  const traces: StepTrace[] = []
  const degraded: string[] = []
  const log = host.logger('tier-router')

  const wanted = { project: input.project, pool }

  // ── 根任务：整条 workflow 的锚点 ──
  const root = host.tasks.create({
    title: `分层执行：${goal.slice(0, 60)}`,
    description: goal,
    status: 'doing',
    priority: 'high',
    project: 'tier-router',
    tags: ['tier-router', 'workflow'],
    creator: { kind: 'agent', name: 'tier-router' },
  })

  // ── 一层：Claude 规划 ──
  const planner = await ensureWorker(host, planTier(), runLabel, wanted)
  const planRun = await timed(() =>
    planner.ask(
      [
        `目标：${goal}`,
        input.project ? `工作目录：${input.project}` : '',
        '请按你的 JSON 规范输出拆解方案。',
      ]
        .filter(Boolean)
        .join('\n'),
    ),
  )
  traces.push(trace(planner, host, planRun.ms, planRun.value))
  const plan = parsePlan(planRun.value, goal)
  if (plan.degraded) degraded.push('规划层未返回可解析 JSON，已降级为单子任务')
  host.tasks.report(root.id, {
    sessionId: planner.sessionId,
    turn: null,
    status: 'doing',
    note: `规划完成：${plan.subtasks.length} 个子任务（${effectiveModel(host, planner.sessionId)}）`,
    ts: Date.now(),
  })

  // 子任务建档：挂在根任务下，形成 workflow 的树结构
  const childTasks = plan.subtasks.map((sub) =>
    host.tasks.create({
      title: sub.title,
      description: sub.detail,
      status: 'todo',
      difficulty: sub.difficulty,
      parentId: root.id,
      project: 'tier-router',
      tags: ['tier-router', 'exec'],
      creator: { kind: 'agent', name: 'tier-router' },
    }),
  )

  // ── 二层：GPT 统筹分派 ──
  const slots = execSlots()
  const coordinator = await ensureWorker(host, coordTier(), runLabel, wanted)
  const dispatchRun = await timed(() =>
    coordinator.ask(
      [
        `目标：${plan.goal}`,
        '子任务清单：',
        ...plan.subtasks.map((s, i) => `${i}. ${s.title} —— ${s.detail}`),
        `可用 worker 槽位：${slots.map((s) => `${s.slot}(${s.label})`).join('、')}`,
        '请输出分派 JSON。',
      ].join('\n'),
    ),
  )
  traces.push(trace(coordinator, host, dispatchRun.ms, dispatchRun.value))
  const parsedAssign = parseAssignments(
    dispatchRun.value,
    plan.subtasks.length,
    slots.map((s) => s.slot),
  )
  if (parsedAssign.degraded) degraded.push('统筹层分派不完整，缺失项已按 round-robin 补齐')

  // 把分派结果写回任务的 assignee，任务面板上能看到谁在做哪条
  const execWorkers = new Map<string, WorkerHandle>()
  for (const def of slots) {
    execWorkers.set(def.slot, await ensureWorker(host, def, runLabel, wanted))
  }
  for (const item of parsedAssign.assignments) {
    const worker = execWorkers.get(item.slot)
    const task = childTasks[item.index]
    if (!worker || !task) continue
    host.tasks.update(task.id, {
      assignee: { kind: 'agent', name: worker.def.label, sessionId: worker.sessionId },
      assignedAt: Date.now(),
      notes: item.brief,
    })
  }

  if (input.dryRun) {
    host.tasks.report(root.id, {
      sessionId: coordinator.sessionId,
      turn: null,
      status: 'doing',
      note: 'dryRun：已完成规划与分派，未执行',
      ts: Date.now(),
    })
    return {
      goal: plan.goal,
      runLabel,
      rootTaskId: root.id,
      plan,
      trace: traces,
      outcomes: parsedAssign.assignments.map((a) => ({
        index: a.index,
        slot: a.slot,
        title: plan.subtasks[a.index]?.title ?? '',
        taskId: childTasks[a.index]?.id ?? '',
        model: execWorkers.get(a.slot)?.def.model ?? '',
        text: '',
        ms: 0,
        ok: true,
      })),
      review: '（dryRun 未执行）',
      degraded,
      totalMs: Date.now() - startedAll,
    }
  }

  // ── 三层：Kimi / DeepSeek 并行执行 ──
  // 同 slot 的多条子任务要串行（一个 session 一次只能跑一个回合），
  // 不同 slot 之间并行。按 slot 分组后组内顺序、组间 Promise.all。
  const bySlot = new Map<string, typeof parsedAssign.assignments>()
  for (const item of parsedAssign.assignments) {
    const list = bySlot.get(item.slot) ?? []
    list.push(item)
    bySlot.set(item.slot, list)
  }

  const outcomes: ExecOutcome[] = []
  await Promise.all(
    [...bySlot.entries()].map(async ([slot, items]) => {
      const worker = execWorkers.get(slot)
      if (!worker) return
      for (const item of items) {
        const sub = plan.subtasks[item.index]
        const task = childTasks[item.index]
        if (!sub || !task) continue
        host.tasks.update(task.id, { status: 'doing' })
        try {
          const run = await timed(() =>
            worker.ask(
              [
                `总目标：${plan.goal}`,
                `你的子任务：${sub.title}`,
                sub.detail ? `要求：${sub.detail}` : '',
                item.brief ? `统筹层补充：${item.brief}` : '',
                '直接给出成品结果。',
              ]
                .filter(Boolean)
                .join('\n'),
            ),
          )
          traces.push(trace(worker, host, run.ms, run.value))
          outcomes.push({
            index: item.index,
            slot,
            title: sub.title,
            taskId: task.id,
            model: effectiveModel(host, worker.sessionId) || worker.def.model,
            text: run.value,
            ms: run.ms,
            ok: true,
          })
          host.tasks.report(task.id, {
            sessionId: worker.sessionId,
            turn: null,
            status: 'done',
            note: `${worker.def.label} 完成（${run.value.length} 字）`,
            ts: Date.now(),
          })
          host.tasks.update(task.id, { status: 'done' })
        } catch (error) {
          const detail = String(error)
          log.error(`exec failed slot=${slot} index=${item.index}: ${detail}`)
          degraded.push(`执行层 ${slot} 子任务#${item.index} 失败：${detail}`)
          outcomes.push({
            index: item.index,
            slot,
            title: sub.title,
            taskId: task.id,
            model: worker.def.model,
            text: '',
            ms: 0,
            ok: false,
            error: detail,
          })
          host.tasks.report(task.id, {
            sessionId: worker.sessionId,
            turn: null,
            status: 'doing',
            note: `执行失败：${detail.slice(0, 200)}`,
            ts: Date.now(),
          })
        }
      }
    }),
  )
  outcomes.sort((a, b) => a.index - b.index)

  // ── 回到二层：GPT 验收 + 整合 ──
  const reviewRun = await timed(() =>
    coordinator.ask(
      [
        `目标：${plan.goal}`,
        '各 worker 交付如下，请验收并整合成一份最终结果。',
        ...outcomes.map(
          (o) =>
            `【子任务${o.index}·${o.slot}·${o.model}】${o.title}\n${o.ok ? o.text.slice(0, 4000) : `（失败：${o.error}）`}`,
        ),
        '输出格式：一、整合结果（可直接交付的内容）；二、验收意见（每条子任务一句，指出问题或确认通过）；三、若有缺口列出补救建议。',
      ].join('\n\n'),
    ),
  )
  traces.push(trace(coordinator, host, reviewRun.ms, reviewRun.value))

  const allOk = outcomes.every((o) => o.ok)
  host.tasks.report(root.id, {
    sessionId: coordinator.sessionId,
    turn: null,
    status: allOk ? 'done' : 'doing',
    note: allOk
      ? `统筹验收完成，${outcomes.length} 条子任务全部交付`
      : `统筹验收完成，存在失败子任务（${outcomes.filter((o) => !o.ok).length} 条）`,
    ts: Date.now(),
  })
  host.tasks.update(root.id, { status: allOk ? 'done' : 'doing' })

  return {
    goal: plan.goal,
    runLabel,
    rootTaskId: root.id,
    plan,
    trace: traces,
    outcomes,
    review: reviewRun.value,
    degraded,
    totalMs: Date.now() - startedAll,
  }
}
