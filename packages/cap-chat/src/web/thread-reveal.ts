import type { ChatNode } from '@biu/web-session-view'

/** 每个 user 与其后的回复合成一回合。 */
export function groupNodesIntoTurns(nodes: ChatNode[]): ChatNode[][] {
  const turns: ChatNode[][] = []
  let current: ChatNode[] = []
  for (const node of nodes) {
    if (node.kind === 'user') {
      if (current.length) turns.push(current)
      current = [node]
      continue
    }
    if (!current.length) {
      turns.push([node])
      continue
    }
    current.push(node)
  }
  if (current.length) turns.push(current)
  return turns
}

/** 首帧只挂最近几回合，先画出视口里能看见的尾巴。 */
export const CHAT_FIRST_PAINT_TURNS = 2
/** 视口填满后，每帧/idle 再往上补的回合数。 */
export const CHAT_REVEAL_BATCH = 4
const VIEWPORT_SLACK_PX = 64
const NEAR_TOP_PX = 720

export function firstPaintStartIndex(totalTurns: number): number {
  if (totalTurns <= 0) return 0
  return Math.max(0, totalTurns - CHAT_FIRST_PAINT_TURNS)
}

export function bumpRevealStart(startIndex: number, batch = CHAT_REVEAL_BATCH): number {
  return Math.max(0, startIndex - Math.max(1, batch))
}

/** 视口还没被尾巴填满，或用户已经滑到顶等更早内容：用 rAF 快补。 */
export function shouldRevealFast(opts: {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
}): boolean {
  if (opts.scrollHeight <= opts.clientHeight + VIEWPORT_SLACK_PX) return true
  if (opts.scrollTop <= NEAR_TOP_PX) return true
  return false
}

export function sliceTurnsFrom(nodes: ChatNode[], startTurnIndex: number): ChatNode[] {
  const turns = groupNodesIntoTurns(nodes)
  if (startTurnIndex <= 0) return nodes
  if (startTurnIndex >= turns.length) return []
  return turns.slice(startTurnIndex).flat()
}
