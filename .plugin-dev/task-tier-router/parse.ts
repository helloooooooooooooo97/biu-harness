/**
 * 模型输出的结构化解析。
 *
 * 现实约束：即使 prompt 里写了「严格 JSON」，模型仍可能裹 markdown 围栏、
 * 或在 JSON 前后加一句解释。这里做容错提取，失败时给出可降级的结果，
 * 而不是让整条 workflow 崩掉。
 */

export interface PlanSubtask {
  title: string
  detail: string
  difficulty: 'low' | 'med' | 'high'
}

export interface PlanResult {
  goal: string
  subtasks: PlanSubtask[]
  risks: string[]
  /** true 表示 JSON 没解析出来、走了降级路径 */
  degraded: boolean
  raw: string
}

export interface Assignment {
  index: number
  slot: string
  brief: string
}

/** 从可能带围栏/前后缀的文本里抠出第一个 JSON 对象。 */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json/gi, '```').trim()
  const fenced = cleaned.match(/```\s*([\s\S]*?)```/)
  const candidates: string[] = []
  if (fenced?.[1]) candidates.push(fenced[1].trim())
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start >= 0 && end > start) candidates.push(cleaned.slice(start, end + 1))
  candidates.push(cleaned)
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate)
    } catch {
      continue
    }
  }
  return null
}

function asDifficulty(value: unknown): 'low' | 'med' | 'high' {
  return value === 'low' || value === 'high' ? value : 'med'
}

export function parsePlan(text: string, fallbackGoal: string): PlanResult {
  const raw = text
  const data = extractJson(text) as Record<string, unknown> | null
  const subtasksRaw = Array.isArray(data?.subtasks) ? data!.subtasks : []
  const subtasks: PlanSubtask[] = subtasksRaw
    .map((item) => {
      const row = (item ?? {}) as Record<string, unknown>
      const title = String(row.title ?? '').trim()
      if (!title) return null
      return {
        title: title.slice(0, 120),
        detail: String(row.detail ?? '').trim(),
        difficulty: asDifficulty(row.difficulty),
      }
    })
    .filter((item): item is PlanSubtask => item !== null)
    .slice(0, 6)

  if (!subtasks.length) {
    // 降级：规划层没给出可用 JSON，就把原目标当成单个子任务往下走，
    // workflow 仍然完整，只是并行度退化为 1。
    return {
      goal: fallbackGoal,
      subtasks: [{ title: fallbackGoal.slice(0, 120), detail: raw.slice(0, 2000), difficulty: 'med' }],
      risks: [],
      degraded: true,
      raw,
    }
  }

  const risks = Array.isArray(data?.risks)
    ? data!.risks.map((r) => String(r).trim()).filter(Boolean).slice(0, 8)
    : []

  return {
    goal: String(data?.goal ?? '').trim() || fallbackGoal,
    subtasks,
    risks,
    degraded: false,
    raw,
  }
}

/**
 * 解析统筹层的分派方案。
 * 解析失败或覆盖不全时，用 round-robin 补齐——保证每个子任务都有 worker，
 * 不会因为统筹层漏写一条就把子任务丢掉。
 */
export function parseAssignments(
  text: string,
  subtaskCount: number,
  slots: string[],
): { assignments: Assignment[]; degraded: boolean } {
  const data = extractJson(text) as Record<string, unknown> | null
  const rows = Array.isArray(data?.assignments) ? data!.assignments : []
  const bySlot = new Map<number, Assignment>()
  for (const item of rows) {
    const row = (item ?? {}) as Record<string, unknown>
    const index = Number(row.index)
    if (!Number.isInteger(index) || index < 0 || index >= subtaskCount) continue
    const slot = slots.includes(String(row.slot)) ? String(row.slot) : slots[index % slots.length]!
    bySlot.set(index, {
      index,
      slot,
      brief: String(row.brief ?? '').trim(),
    })
  }
  const degraded = bySlot.size < subtaskCount
  for (let i = 0; i < subtaskCount; i += 1) {
    if (bySlot.has(i)) continue
    bySlot.set(i, { index: i, slot: slots[i % slots.length]!, brief: '' })
  }
  return {
    assignments: [...bySlot.values()].sort((a, b) => a.index - b.index),
    degraded,
  }
}
