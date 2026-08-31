import type { PickRef } from './types.ts'

const KIND = 'data-biu-kind'
const ID = 'data-biu-id'
const ACTION = 'data-biu-action'
const LABEL = 'data-biu-label'

export function isPickIgnored(node: Element | null) {
  return Boolean(node?.closest('[data-biu-ignore]'))
}

function read(el: Element, attr: string) {
  const value = el.getAttribute(attr)
  return value && value.trim() ? value.trim() : undefined
}

/** 从命中节点向上合并 data-biu-*，子覆盖父；必须同时有 kind 与 id。 */
export function resolvePickFromNode(start: Element | null, route: string): { el: HTMLElement; ref: PickRef } | null {
  if (!start || isPickIgnored(start)) return null
  let kind: string | undefined
  let id: string | undefined
  let action: string | undefined
  let label: string | undefined
  let highlight: HTMLElement | null = null
  let node: Element | null = start
  while (node && node !== document.documentElement) {
    if (node instanceof HTMLElement) {
      const nextKind = read(node, KIND)
      const nextId = read(node, ID)
      const nextAction = read(node, ACTION)
      const nextLabel = read(node, LABEL)
      if (!highlight && (nextKind || nextId || nextAction || nextLabel)) highlight = node
      if (!kind) kind = nextKind
      if (!id) id = nextId
      if (!action) action = nextAction
      if (!label) label = nextLabel
    }
    if (kind && id && highlight) break
    node = node.parentElement
  }
  if (!kind || !id || !highlight) return null
  return {
    el: highlight,
    ref: {
      kind,
      id,
      ...(action ? { action } : {}),
      label: label || id,
      route,
    },
  }
}

export function resolvePickAtPoint(x: number, y: number, route: string) {
  const stacked = document.elementsFromPoint(x, y)
  if (stacked.some((el) => el instanceof Element && el.closest('[data-testid="chat-overlay-panel"]'))) return null
  for (const el of stacked) {
    if (el instanceof Element && isPickIgnored(el)) continue
    const hit = resolvePickFromNode(el, route)
    if (hit) return hit
  }
  return null
}

export type ClientBox = { left: number; top: number; width: number; height: number }

export function boxFromPoints(ax: number, ay: number, bx: number, by: number): ClientBox {
  const left = Math.min(ax, bx)
  const top = Math.min(ay, by)
  return { left, top, width: Math.abs(bx - ax), height: Math.abs(by - ay) }
}

export function boxesOverlap(a: ClientBox, b: ClientBox) {
  return a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top
}

function boxOf(el: Element): ClientBox {
  const r = el.getBoundingClientRect()
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}

/**
 * 框选：命中所有带 kind+id 的对象节点（不采内部 action）。
 * 点选仍走 resolvePickFromNode，可以打到按钮上的 action。
 */
export function resolvePicksInRect(box: ClientBox, route: string, root: ParentNode = document) {
  const nodes = root.querySelectorAll('[data-biu-kind][data-biu-id]')
  const seen = new Set<string>()
  const hits: { el: HTMLElement; ref: PickRef }[] = []
  for (const node of Array.from(nodes)) {
    if (!(node instanceof HTMLElement) || isPickIgnored(node)) continue
    if (!boxesOverlap(box, boxOf(node))) continue
    const hit = resolvePickFromNode(node, route)
    if (!hit) continue
    const key = `${hit.ref.kind}:${hit.ref.id}`
    if (seen.has(key)) continue
    seen.add(key)
    hits.push(hit)
  }
  return hits
}
