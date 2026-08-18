/** SteeringService：steer/inject 返回回执（第 47 课）。 */
import { ReceiptStore, type InboxTarget } from './receipts.ts'

export interface InboxLike {
  steer(content: string): { id: string; content: string }
  inject(content: string): { id: string; content: string }
  claimNextStep(): Array<{ id: string; content: string }>
}

export class SteeringService {
  constructor(
    private readonly store: ReceiptStore,
    private readonly inbox: InboxLike,
  ) {}

  steer(content: string): string {
    const message = this.inbox.steer(content)
    return this.store.accept(message.id, 'next-step').messageId
  }

  inject(content: string): string {
    const message = this.inbox.inject(content)
    return this.store.accept(message.id, 'next-step').messageId
  }

  /** step 拿走插队消息 → 标记 claimed。 */
  claimNextStep(): string[] {
    const claimed = this.inbox.claimNextStep()
    for (const message of claimed) this.store.mark(message.id, 'claimed')
    return claimed.map((m) => m.id)
  }

  discard(messageId: string): void {
    this.store.mark(messageId, 'discarded')
  }

  receipt(messageId: string) {
    return this.store.get(messageId)
  }
}
