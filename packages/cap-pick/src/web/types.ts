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

export function objectKey(ref: PickRef) {
  return `${ref.kind}:${ref.id}`
}

/** 同一 kind+id 只保留一条；后写覆盖，并保留已有 action/label。 */
export function dedupePicks(refs: PickRef[]): PickRef[] {
  const map = new Map<string, PickRef>()
  for (const ref of refs) {
    const key = objectKey(ref)
    const prev = map.get(key)
    if (!prev) {
      map.set(key, ref)
      continue
    }
    map.set(key, {
      kind: ref.kind,
      id: ref.id,
      label: ref.label || prev.label,
      route: ref.route || prev.route,
      ...(ref.action || prev.action ? { action: ref.action || prev.action } : {}),
    })
  }
  return [...map.values()]
}

export function formatPicks(refs: PickRef[]) {
  return dedupePicks(refs)
    .map((ref) => {
      const attrs = [`kind="${escapeAttr(ref.kind)}"`, `id="${escapeAttr(ref.id)}"`]
      if (ref.action) attrs.push(`action="${escapeAttr(ref.action)}"`)
      if (ref.route) attrs.push(`route="${escapeAttr(ref.route)}"`)
      if (ref.label) attrs.push(`label="${escapeAttr(ref.label)}"`)
      return `<pick ${attrs.join(' ')} />`
    })
    .join('\n')
}

const PICK_TAG = /<pick\b([^>]*)\/>/gi
const ATTR = /(\w+)="([^"]*)"/g

function unescapeAttr(value: string) {
  return value.replace(/&quot;/g, '"').replace(/&amp;/g, '&')
}

function parsePickAttrs(raw: string): PickRef | null {
  const attrs: Record<string, string> = {}
  ATTR.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = ATTR.exec(raw))) {
    attrs[match[1]] = unescapeAttr(match[2])
  }
  const kind = attrs.kind?.trim()
  const id = attrs.id?.trim()
  if (!kind || !id) return null
  return {
    kind,
    id,
    ...(attrs.action?.trim() ? { action: attrs.action.trim() } : {}),
    label: attrs.label?.trim() || id,
    route: attrs.route?.trim() || '',
  }
}

/** 从用户消息里拆出 <pick /> 句柄，剩下的才走 Markdown（否则标签会被消毒掉）。 */
export function parsePicks(text: string): { refs: PickRef[]; rest: string } {
  const refs: PickRef[] = []
  PICK_TAG.lastIndex = 0
  const rest = text
    .replace(PICK_TAG, (_all, raw: string) => {
      const ref = parsePickAttrs(raw)
      if (ref) refs.push(ref)
      return '\n'
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { refs: dedupePicks(refs), rest }
}

function escapeAttr(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

export function chipLabel(ref: PickRef) {
  if (ref.action) return `${ref.label} · ${ref.action}`
  return ref.label
}

export function pickPreview(text: string, max = 48) {
  const value = text.replace(/\s+/g, ' ').trim()
  if (!value) return ''
  return value.length > max ? `${value.slice(0, max)}…` : value
}

export function pickDomAttrs(kind: string, id: string, label?: string) {
  return {
    'data-biu-kind': kind,
    'data-biu-id': id,
    ...(label ? { 'data-biu-label': label } : {}),
  }
}
