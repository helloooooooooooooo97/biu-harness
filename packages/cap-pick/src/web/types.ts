export type PickRef = {
  kind: string
  id: string
  action?: string
  label: string
  route: string
}

export function pickKey(ref: PickRef) {
  return `${ref.kind}:${ref.id}:${ref.action ?? ''}`
}

export function formatPicks(refs: PickRef[]) {
  return refs
    .map((ref) => {
      const attrs = [`kind="${escapeAttr(ref.kind)}"`, `id="${escapeAttr(ref.id)}"`]
      if (ref.action) attrs.push(`action="${escapeAttr(ref.action)}"`)
      if (ref.route) attrs.push(`route="${escapeAttr(ref.route)}"`)
      return `<pick ${attrs.join(' ')} />`
    })
    .join('\n')
}

function escapeAttr(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

export function chipLabel(ref: PickRef) {
  if (ref.action) return `${ref.label} · ${ref.action}`
  return ref.label
}
