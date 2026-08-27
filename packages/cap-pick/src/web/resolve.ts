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
  for (const el of stacked) {
    if (el instanceof Element && isPickIgnored(el)) continue
    const hit = resolvePickFromNode(el, route)
    if (hit) return hit
  }
  return null
}
