/** 消息回执与 SteeringService（第 47 课）。 */

export type ReceiptStatus = 'accepted' | 'claimed' | 'discarded'
export type InboxTarget = 'next-turn' | 'next-step'

export interface Receipt {
  messageId: string
  status: ReceiptStatus
  target: InboxTarget
  at: string
}

export class ReceiptStore {
  private readonly receipts = new Map<string, Receipt>()

  accept(messageId: string, target: InboxTarget): Receipt {
    const receipt: Receipt = { messageId, status: 'accepted', target, at: new Date().toISOString() }
    this.receipts.set(messageId, receipt)
    return receipt
  }

  mark(messageId: string, status: ReceiptStatus): void {
    const receipt = this.receipts.get(messageId)
    if (!receipt) throw new Error(`未知回执: ${messageId}`)
    receipt.status = status
  }

  get(messageId: string): Receipt | undefined {
    return this.receipts.get(messageId)
  }
}

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
    return this.store.accept(this.inbox.steer(content).id, 'next-step').messageId
  }

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
