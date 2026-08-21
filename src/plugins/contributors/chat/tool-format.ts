export type DiffLine = { type: 'add' | 'remove' | 'equal'; text: string }

export type ParsedToolCall =
  | { kind: 'str_replace'; path: string; oldStr: string; newStr: string }
  | { kind: 'create'; path: string; fileText: string }
  | { kind: 'insert'; path: string; insertLine: number; newStr: string }
  | { kind: 'view'; path: string; viewRange?: [number, number] }
  | { kind: 'bash'; command: string }
  | { kind: 'raw'; label: string; raw: string }

const DIFF_LINE_CAP = 400

/** 行级 LCS diff；超大块退化为整段删除 + 整段新增，避免卡 UI。 */
export function lineDiff(oldText: string, newText: string): DiffLine[] {
  if (oldText === newText) {
    return oldText === '' ? [] : oldText.split('\n').map((text) => ({ type: 'equal' as const, text }))
  }
  const a = oldText.split('\n')
  const b = newText.split('\n')
  if (a.length * b.length > DIFF_LINE_CAP * DIFF_LINE_CAP) {
    return [
      ...a.map((text) => ({ type: 'remove' as const, text })),
      ...b.map((text) => ({ type: 'add' as const, text })),
    ]
  }

  const n = a.length
  const m = b.length
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i]![j] = a[i] === b[j] ? (dp[i + 1]![j + 1]! + 1) : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!)
    }
  }

  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: 'equal', text: a[i]! })
      i += 1
      j += 1
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      out.push({ type: 'remove', text: a[i]! })
      i += 1
    } else {
      out.push({ type: 'add', text: b[j]! })
      j += 1
    }
  }
  while (i < n) {
    out.push({ type: 'remove', text: a[i]! })
    i += 1
  }
  while (j < m) {
    out.push({ type: 'add', text: b[j]! })
    j += 1
  }
  return out
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const text = raw.trim()
  if (!text.startsWith('{')) return null
  try {
    const value = JSON.parse(text) as unknown
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    return value as Record<string, unknown>
  } catch {
    return null
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function asInt(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return Number(value)
  return undefined
}

export function parseToolCall(name: string, argumentsJson: string): ParsedToolCall {
  const args = parseJsonObject(argumentsJson)

  if (name === 'bash' || name === 'shell' || name === 'run_terminal_cmd') {
    const command = asString(args?.command) ?? asString(args?.cmd) ?? argumentsJson.trim()
    return { kind: 'bash', command }
  }

  if (name === 'str_replace_editor' || name === 'StrReplace' || name === 'str_replace') {
    const command = asString(args?.command) ?? (name === 'str_replace' || name === 'StrReplace' ? 'str_replace' : undefined)
    const path = asString(args?.path) ?? asString(args?.file_path) ?? 'unknown'
    if (command === 'str_replace' || (!command && asString(args?.old_str) != null)) {
      return {
        kind: 'str_replace',
        path,
        oldStr: asString(args?.old_str) ?? asString(args?.old_string) ?? '',
        newStr: asString(args?.new_str) ?? asString(args?.new_string) ?? '',
      }
    }
    if (command === 'create') {
      return { kind: 'create', path, fileText: asString(args?.file_text) ?? '' }
    }
    if (command === 'insert') {
      return {
        kind: 'insert',
        path,
        insertLine: asInt(args?.insert_line) ?? 0,
        newStr: asString(args?.new_str) ?? '',
      }
    }
    if (command === 'view') {
      const range = Array.isArray(args?.view_range) ? args.view_range : undefined
      const start = range ? asInt(range[0]) : undefined
      const end = range && range.length > 1 ? asInt(range[1]) : start
      return {
        kind: 'view',
        path,
        viewRange: start != null && end != null ? [start, end] : undefined,
      }
    }
  }

  if (name === 'fs_write' || name === 'Write') {
    const path = asString(args?.path) ?? asString(args?.file_path) ?? 'unknown'
    const fileText = asString(args?.contents) ?? asString(args?.content) ?? asString(args?.file_text) ?? ''
    return { kind: 'create', path, fileText }
  }

  return { kind: 'raw', label: name, raw: argumentsJson }
}

export function toolSummary(parsed: ParsedToolCall, fallback: string): string {
  switch (parsed.kind) {
    case 'str_replace':
      return `Edited ${parsed.path}`
    case 'create':
      return `Created ${parsed.path}`
    case 'insert':
      return `Inserted @${parsed.insertLine} · ${parsed.path}`
    case 'view':
      return parsed.viewRange
        ? `View ${parsed.path}:${parsed.viewRange[0]}-${parsed.viewRange[1]}`
        : `View ${parsed.path}`
    case 'bash': {
      const one = parsed.command.replace(/\s+/g, ' ').trim()
      return one.length > 72 ? `${one.slice(0, 72)}…` : one || fallback
    }
    case 'raw':
      return fallback
  }
}

export function toolTitle(parsed: ParsedToolCall, name: string): string {
  switch (parsed.kind) {
    case 'str_replace':
      return 'Edit'
    case 'create':
      return 'Create'
    case 'insert':
      return 'Insert'
    case 'view':
      return 'View'
    case 'bash':
      return 'Bash'
    case 'raw':
      return name
  }
}

export function shouldAutoOpenTool(parsed: ParsedToolCall): boolean {
  return parsed.kind === 'str_replace' || parsed.kind === 'create' || parsed.kind === 'insert'
}

export function diffStats(lines: DiffLine[]): { added: number; removed: number } {
  let added = 0
  let removed = 0
  for (const line of lines) {
    if (line.type === 'add') added += 1
    else if (line.type === 'remove') removed += 1
  }
  return { added, removed }
}
