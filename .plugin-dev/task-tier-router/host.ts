/**
 * 分层任务编排插件。
 *
 * 三级 workflow：
 *   plan（Claude）→ coord（GPT 分派）→ exec（Kimi ‖ DeepSeek）→ coord（GPT 验收整合）
 *
 * 每层跑各自模型：通过写 session.config.{provider,model} 实现，
 * cap-chat.resolveLlm(sessionId) 会让该 session 的每个回合走对应上游。
 */

import { TIERS } from './tiers.ts'
import { runTieredFlow, type FlowHost, type RunResult } from './flow.ts'

export const name = 'task-tier-router'
export const inject = ['tools', 'sessions', 'agents', 'tasks']

interface Ctx extends FlowHost {
  tools: {
    register(spec: {
      name: string
      description: string
      parameters: Record<string, unknown>
      execute: (args: Record<string, unknown>) => unknown
    }): unknown
  }
}

/** 报告：把 trace 做成表格，肉眼可核对每层用了哪个模型。 */
function renderReport(result: RunResult): string {
  const lines: string[] = []
  lines.push(`目标：${result.goal}`)
  lines.push(`根任务：${result.rootTaskId} · 总耗时 ${(result.totalMs / 1000).toFixed(1)}s`)
  lines.push('')
  lines.push('层级调用轨迹：')
  lines.push('| 层级 | 槽位 | 模型 | 耗时 | 输出字数 |')
  lines.push('|---|---|---|---|---|')
  for (const t of result.trace) {
    lines.push(`| ${t.tier} | ${t.slot} | ${t.model} | ${(t.ms / 1000).toFixed(1)}s | ${t.chars} |`)
  }
  lines.push('')
  lines.push(`规划层拆出 ${result.plan.subtasks.length} 条子任务：`)
  for (const [i, sub] of result.plan.subtasks.entries()) {
    const outcome = result.outcomes.find((o) => o.index === i)
    const who = outcome ? `${outcome.slot}/${outcome.model}` : '未分派'
    lines.push(`${i}. ${sub.title} → ${who}${outcome && !outcome.ok ? ' ❌' : ''}`)
  }
  if (result.plan.risks.length) {
    lines.push('')
    lines.push(`规划层提示风险：${result.plan.risks.join('；')}`)
  }
  if (result.degraded.length) {
    lines.push('')
    lines.push('降级记录：')
    for (const d of result.degraded) lines.push(`- ${d}`)
  }
  lines.push('')
  lines.push('统筹层验收与整合：')
  lines.push(result.review)
  return lines.join('\n')
}

export function apply(ctx: Ctx) {
  ctx.tools.register({
    name: 'tier_flow_run',
    description:
      '分层 workflow：接到目标后 Claude 规划拆解 → GPT 统筹分派 → Kimi/DeepSeek 并行执行 → GPT 验收整合。' +
      '每层跑各自模型，全过程落任务面板（根任务+子任务+report）。返回各层调用轨迹与最终整合结果。',
    parameters: {
      type: 'object',
      properties: {
        goal: { type: 'string', description: '要交付的目标，一句话描述' },
        project: { type: 'string', description: '可选：给各层 session 绑定的工作目录绝对路径' },
        dryRun: { type: 'boolean', description: '只做规划与分派预览，不真正执行' },
        format: {
          type: 'string',
          enum: ['report', 'json'],
          description: 'report=可读报告（默认）；json=原始结构',
        },
      },
      required: ['goal'],
    },
    execute: async (args) => {
      const result = await runTieredFlow(ctx, {
        goal: String(args.goal ?? ''),
        ...(typeof args.project === 'string' && args.project.trim()
          ? { project: args.project.trim() }
          : {}),
        dryRun: args.dryRun === true,
      })
      if (args.format === 'json') return result
      return {
        rootTaskId: result.rootTaskId,
        totalMs: result.totalMs,
        report: renderReport(result),
        sessions: result.trace.map((t) => ({
          tier: t.tier,
          slot: t.slot,
          model: t.model,
          sessionId: t.sessionId,
        })),
      }
    },
  })

  ctx.tools.register({
    name: 'tier_flow_tiers',
    description: '查看分层 workflow 的层级 → 模型映射（规划/统筹/执行各用哪个模型）。',
    parameters: { type: 'object', properties: {} },
    execute: () => ({
      tiers: TIERS.map((t) => ({
        tier: t.tier,
        slot: t.slot,
        label: t.label,
        provider: t.provider,
        model: t.model,
      })),
      note: '模型按 session.config 覆盖生效；改映射请编辑插件 tiers.ts 后重新 plugin_pack。',
    }),
  })
}
