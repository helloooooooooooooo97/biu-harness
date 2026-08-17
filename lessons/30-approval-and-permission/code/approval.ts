/** ApprovalGate：可注入决策者的审批门（缺省拒绝，fail-closed）。 */

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
