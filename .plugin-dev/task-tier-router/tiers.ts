/**
 * 三级 workflow 的层级定义。
 *
 * 每层绑定一个模型：层级职责不同，对模型的要求也不同——
 *  - plan（规划）：长链推理、拆解，用 Claude
 *  - coord（统筹）：分派、验收、整合，用 GPT
 *  - exec（执行）：并行干活，用 Kimi / DeepSeek 两个 worker
 *
 * provider 统一 'openai'：当前 aiapi 入口是 OpenAI 兼容协议，
 * 真正决定走哪家上游的是 model 名（chat.resolveLlm 按 endpoint 取 baseUrl + key）。
 */

export type TierId = 'plan' | 'coord' | 'exec'

export type TierProvider = 'deepseek' | 'openai' | 'anthropic'

export interface TierDef {
  /** 层级 id */
  tier: TierId
  /** worker 槽位 key，exec 层有多个 */
  slot: string
  /** 展示名 */
  label: string
  provider: TierProvider
  model: string
  /** 该槽位 session 的 systemPrompt */
  persona: string
}

const PLAN_PERSONA = [
  '你是分层 workflow 的【规划层】，使用 Claude。',
  '职责：把用户目标拆成可独立执行的子任务，只做规划不做执行。',
  '输出严格用 JSON，不要 markdown 代码围栏，不要额外解释：',
  '{"goal":"一句话目标","subtasks":[{"title":"子任务标题","detail":"要做什么、验收标准","difficulty":"low|med|high"}],"risks":["风险点"]}',
  'subtasks 控制在 2~4 条，彼此尽量独立以便并行。',
].join('\n')

const COORD_PERSONA = [
  '你是分层 workflow 的【统筹层】，使用 GPT。',
  '职责：把规划层的子任务分派给执行层 worker，并在执行完成后验收、整合。',
  '分派阶段输出严格 JSON，不要 markdown 代码围栏：',
  '{"assignments":[{"index":0,"slot":"kimi|deepseek","brief":"给该 worker 的执行指令"}]}',
  'slot 只能是 kimi 或 deepseek，index 是子任务下标。尽量让两个 worker 负载均衡。',
  '验收阶段按要求输出中文报告，不需要 JSON。',
].join('\n')

function execPersona(label: string): string {
  return [
    `你是分层 workflow 的【执行层】worker（${label}）。`,
    '职责：按统筹层给的指令直接产出结果，不要再往下派工。',
    '要求：输出可直接使用的成品内容，简洁、无寒暄、不要复述指令。',
  ].join('\n')
}

/** 层级 → 模型的固定映射。改模型只动这里。 */
export const TIERS: TierDef[] = [
  {
    tier: 'plan',
    slot: 'claude',
    label: 'Claude 规划',
    provider: 'openai',
    model: 'claude-sonnet-4-6',
    persona: PLAN_PERSONA,
  },
  {
    tier: 'coord',
    slot: 'gpt',
    label: 'GPT 统筹',
    provider: 'openai',
    model: 'gpt-5.1',
    persona: COORD_PERSONA,
  },
  {
    tier: 'exec',
    slot: 'kimi',
    label: 'Kimi 执行',
    provider: 'openai',
    model: 'kimi-k3',
    persona: execPersona('Kimi'),
  },
  {
    tier: 'exec',
    slot: 'deepseek',
    label: 'DeepSeek 执行',
    provider: 'openai',
    model: 'deepseek-v3.2',
    persona: execPersona('DeepSeek'),
  },
]

export function tierBySlot(slot: string): TierDef | undefined {
  return TIERS.find((t) => t.slot === slot)
}

export function execSlots(): TierDef[] {
  return TIERS.filter((t) => t.tier === 'exec')
}

export function planTier(): TierDef {
  return TIERS.find((t) => t.tier === 'plan')!
}

export function coordTier(): TierDef {
  return TIERS.find((t) => t.tier === 'coord')!
}

/** 会话标题：带层级前缀，便于在侧栏一眼区分。 */
export function sessionTitle(def: TierDef, runLabel: string): string {
  return `[${def.tier}] ${def.label} · ${runLabel}`
}
