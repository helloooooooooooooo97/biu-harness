/** 权限预设：工具动作 → allow / deny / ask。 */
import type { ApprovalGate } from './approval.ts'

export type PermissionPreset = 'read-only' | 'workspace-write' | 'full'

export interface ToolAction {
  name: string
  kind: 'read' | 'write' | 'exec'
}

export type PermissionVerdict = 'allow' | 'deny' | 'ask'

/** 策略即数据：预设 × 动作类型 → 三档裁决。 */
export function policyFor(preset: PermissionPreset, action: ToolAction): PermissionVerdict {
  switch (preset) {
    case 'read-only':
      return action.kind === 'read' ? 'allow' : 'deny'
    case 'workspace-write':
      if (action.kind === 'read' || action.kind === 'write') return 'allow'
      return 'ask'
    case 'full':
      return 'allow'
  }
}

/** 执行裁决：allow 放行、deny 拒绝、ask 走审批。 */
export async function decide(preset: PermissionPreset, action: ToolAction, gate: ApprovalGate): Promise<boolean> {
  const verdict = policyFor(preset, action)
  if (verdict === 'allow') return true
  if (verdict === 'deny') return false
  return gate.ask(`允许执行 ${action.name}？`)
}
