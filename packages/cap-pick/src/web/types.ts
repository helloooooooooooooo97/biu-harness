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

function objectKey(ref: PickRef) {
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

export function formatPick(ref: PickRef) {
  return formatPicks([ref])
}

/** 按原文顺序拆成文字段和 pick 块，供输入框混排还原。 */
export function splitPickStream(text: string): Array<{ type: 'text'; value: string } | { type: 'pick'; ref: PickRef }> {
  const parts: Array<{ type: 'text'; value: string } | { type: 'pick'; ref: PickRef }> = []
  PICK_TAG.lastIndex = 0
  let last = 0
  let match: RegExpExecArray | null
  while ((match = PICK_TAG.exec(text))) {
    if (match.index > last) parts.push({ type: 'text', value: text.slice(last, match.index) })
    const ref = parsePickAttrs(match[1] ?? '')
    if (ref) parts.push({ type: 'pick', ref })
    else parts.push({ type: 'text', value: match[0] })
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) })
  return parts
}
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

/** 选取态下划到的一段正文；空选区返回 null。 */
export function textPickFromSelection(
  route: string,
  selection: Pick<Selection, 'isCollapsed' | 'toString' | 'rangeCount'> | null = typeof window === 'undefined' ? null : window.getSelection(),
): PickRef | null {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null
  const raw = selection.toString()
  const label = pickPreview(raw, 80)
  if (!label) return null
  let hash = 0
  const key = raw.replace(/\s+/g, ' ').trim()
  for (let i = 0; i < key.length; i += 1) hash = (hash * 33 + key.charCodeAt(i)) >>> 0
  return { kind: 'text', id: hash.toString(16), label, route }
}

export function pickDomAttrs(kind: string, id: string, label?: string) {
  return {
    'data-biu-kind': kind,
    'data-biu-id': id,
    ...(label ? { 'data-biu-label': label } : {}),
  }
}
