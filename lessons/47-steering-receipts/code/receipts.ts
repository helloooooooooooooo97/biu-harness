/** 消息回执状态机（第 47 课）。 */

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

  all(): Receipt[] {
    return [...this.receipts.values()]
  }
}
