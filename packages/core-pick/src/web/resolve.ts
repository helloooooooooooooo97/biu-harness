import type { PickRef } from './types.ts'

const KIND = 'data-biu-kind'
const ID = 'data-biu-id'
const ACTION = 'data-biu-action'
const LABEL = 'data-biu-label'

type ClientBox = { left: number; top: number; width: number; height: number }

function isPickIgnored(node: Element | null) {
  return Boolean(node?.closest('[data-biu-ignore]'))
}

function inHiddenPane(node: Element | null) {
  return Boolean(
    node?.closest(
      '.inspector-stage-pane:not(.is-active), .app-stage-pane:not(.is-active), .session-inspector.is-closed, .app-side-bar.is-closed',
    ),
  )
}

/** 点落在哪一栏：检查器 / 侧栏 / 中间台。框选和点选都不跨栏。 */
export function pickSurfaceFromNode(node: Element | null): HTMLElement | null {
  if (!node) return null
  return node.closest('[data-testid="session-inspector"], .app-side-bar')
}

function pointInBox(box: ClientBox, x: number, y: number) {
  return x >= box.left && y >= box.top && x <= box.left + box.width && y <= box.top + box.height
}

function read(el: Element, attr: string) {
  const value = el.getAttribute(attr)
  return value && value.trim() ? value.trim() : undefined
}

/** 从命中节点向上合并 data-biu-*，子覆盖父；必须同时有 kind 与 id。 */
export function resolvePickFromNode(start: Element | null, route: string): { el: HTMLElement; ref: PickRef } | null {
  if (!start || isPickIgnored(start) || inHiddenPane(start)) return null
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
  const surface =
    stacked
      .map((el) => (el instanceof Element ? pickSurfaceFromNode(el) : null))
      .find((node) => node && !node.classList.contains('is-closed')) ?? null
  for (const el of stacked) {
    if (!(el instanceof Element) || isPickIgnored(el) || inHiddenPane(el)) continue
    if (surface && !surface.contains(el)) continue
    const hit = resolvePickFromNode(el, route)
    if (!hit) continue
    if (surface && !surface.contains(hit.el)) continue
    const vis = visiblePickBox(hit.el)
    if (!vis || !pointInBox(vis, x, y)) continue
    return hit
  }
  return null
}

export function boxFromPoints(ax: number, ay: number, bx: number, by: number): ClientBox {
  const left = Math.min(ax, bx)
  const top = Math.min(ay, by)
  return { left, top, width: Math.abs(bx - ax), height: Math.abs(by - ay) }
}

function boxesOverlap(a: ClientBox, b: ClientBox) {
  return a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top
}

function boxOf(el: Element): ClientBox {
  const r = el.getBoundingClientRect()
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}

function intersectBoxes(a: ClientBox, b: ClientBox): ClientBox | null {
  const left = Math.max(a.left, b.left)
  const top = Math.max(a.top, b.top)
  const width = Math.min(a.left + a.width, b.left + b.width) - left
  const height = Math.min(a.top + a.height, b.top + b.height) - top
  if (width <= 0 || height <= 0) return null
  return { left, top, width, height }
}

function axisClips(computed: string, inline: string) {
  const value = computed && computed !== 'visible' ? computed : inline
  return Boolean(value && value !== 'visible')
}

function clipsOverflow(node: HTMLElement) {
  const style = getComputedStyle(node)
  return (
    axisClips(style.overflowX, node.style.overflowX || node.style.overflow) ||
    axisClips(style.overflowY, node.style.overflowY || node.style.overflow)
  )
}

/** 框选只看露在本栏里的那一块。宽表格行的布局盒会伸进检查器，不能拿来当命中。 */
export function visiblePickBox(el: Element): ClientBox | null {
  let box: ClientBox | null = boxOf(el)
  let node: Element | null = el.parentElement
  while (box && node && node !== document.documentElement) {
    if (node instanceof HTMLElement && clipsOverflow(node)) {
      box = intersectBoxes(box, boxOf(node))
    }
    node = node.parentElement
  }
  return box
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
    if (!(node instanceof HTMLElement) || isPickIgnored(node) || inHiddenPane(node)) continue
    const vis = visiblePickBox(node)
    if (!vis || !boxesOverlap(box, vis)) continue
    const hit = resolvePickFromNode(node, route)
    if (!hit) continue
    const key = `${hit.ref.kind}:${hit.ref.id}`
    if (seen.has(key)) continue
    seen.add(key)
    hits.push(hit)
  }
  return hits
}
