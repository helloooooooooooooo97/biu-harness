/** 审批与权限预设（第 30 课）。 */

export type ApproveResolver = (question: string) => Promise<boolean>

export class ApprovalGate {
  constructor(
    private readonly resolver?: ApproveResolver,
    private readonly fallback = false,
  ) {}

  async ask(question: string): Promise<boolean> {
    if (!this.resolver) return this.fallback
    return this.resolver(question)
  }
}

export type PermissionPreset = 'read-only' | 'workspace-write' | 'full'

export interface ToolAction {
  name: string
  kind: 'read' | 'write' | 'exec'
}

export type PermissionVerdict = 'allow' | 'deny' | 'ask'

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

export async function decide(preset: PermissionPreset, action: ToolAction, gate: ApprovalGate): Promise<boolean> {
  const verdict = policyFor(preset, action)
  if (verdict === 'allow') return true
  if (verdict === 'deny') return false
  return gate.ask(`允许执行 ${action.name}？`)
}
