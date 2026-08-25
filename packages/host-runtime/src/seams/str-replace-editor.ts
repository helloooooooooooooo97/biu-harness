import { access, constants, readdir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import type { FsService } from './fs.ts'

const MAX_OUTPUT = 16_000

export type EditorCommand = 'view' | 'create' | 'str_replace' | 'insert'

export async function runStrReplaceEditor(fs: FsService, args: Record<string, unknown>): Promise<string> {
  const command = String(args.command ?? '') as EditorCommand
  const pathArg = String(args.path ?? '')
  if (!pathArg) throw new Error('path is required')
  if (!['view', 'create', 'str_replace', 'insert'].includes(command)) {
    throw new Error(`unsupported command: ${command}`)
  }

  const abs = fs.resolve(pathArg)
  const rel = relative(fs.root, abs) || '.'

  switch (command) {
    case 'view':
      return truncate(await view(fs, abs, rel, args.view_range))
    case 'create':
      return truncate(await create(fs, abs, rel, args.file_text))
    case 'str_replace':
      return truncate(await strReplace(fs, abs, rel, args.old_str, args.new_str))
    case 'insert':
      return truncate(await insert(fs, abs, rel, args.insert_line, args.new_str))
  }
}

async function view(fs: FsService, abs: string, rel: string, viewRange: unknown) {
  const info = await safeStat(abs)
  if (!info) throw new Error(`path does not exist: ${rel}`)
  if (info.isDirectory()) return listTree(abs, rel)
  const content = await fs.read(rel)
  const lines = content.split('\n')
  // trailing empty from final newline is kept as an empty last line for cat -n parity when file ends with \n
  const numbered = numberLines(lines)
  const range = parseViewRange(viewRange, numbered.length)
  if (!range) return numbered.join('\n')
  return numbered.slice(range.start - 1, range.end).join('\n')
}

async function create(fs: FsService, abs: string, rel: string, fileText: unknown) {
  if (await exists(abs)) throw new Error(`file already exists: ${rel}`)
  if (typeof fileText !== 'string') throw new Error('file_text is required for create')
  await fs.write(rel, fileText)
  return `File created successfully at: ${rel}`
}

async function strReplace(fs: FsService, abs: string, rel: string, oldStr: unknown, newStr: unknown) {
  if (typeof oldStr !== 'string') throw new Error('old_str is required for str_replace')
  if (!(await exists(abs))) throw new Error(`file does not exist: ${rel}`)
  const content = await fs.read(rel)
  const occurrences = countOccurrences(content, oldStr)
  if (occurrences === 0) throw new Error(`old_str not found in ${rel}`)
  if (occurrences > 1) throw new Error(`old_str is not unique in ${rel} (${occurrences} matches)`)
  const next = content.replace(oldStr, typeof newStr === 'string' ? newStr : '')
  await fs.write(rel, next)
  return `The file ${rel} has been edited. Please review the changes and make sure they are correct.`
}

async function insert(fs: FsService, abs: string, rel: string, insertLine: unknown, newStr: unknown) {
  if (typeof newStr !== 'string') throw new Error('new_str is required for insert')
  const line = Number(insertLine)
  if (!Number.isInteger(line) || line < 0) throw new Error('insert_line must be a non-negative integer')
  if (!(await exists(abs))) throw new Error(`file does not exist: ${rel}`)
  const content = await fs.read(rel)
  const lines = content.split('\n')
  // insert AFTER insert_line (1-based); 0 inserts before the first line
  if (line > lines.length) throw new Error(`insert_line ${line} is beyond end of file (${lines.length} lines)`)
  lines.splice(line, 0, newStr)
  await fs.write(rel, lines.join('\n'))
  return `The file ${rel} has been edited. Please review the changes and make sure they are correct.`
}

function numberLines(lines: string[]) {
  const width = String(lines.length).length
  return lines.map((line, index) => `${String(index + 1).padStart(width)}\t${line}`)
}

function parseViewRange(viewRange: unknown, lineCount: number): { start: number; end: number } | null {
  if (!Array.isArray(viewRange) || viewRange.length === 0) return null
  const start = Number(viewRange[0])
  const endRaw = viewRange.length > 1 ? Number(viewRange[1]) : start
  if (!Number.isInteger(start) || start < 1) throw new Error('view_range start must be a positive integer')
  const end = endRaw === -1 ? lineCount : endRaw
  if (!Number.isInteger(end) || end < start) throw new Error('invalid view_range')
  return { start, end: Math.min(end, lineCount) }
}

async function listTree(abs: string, rel: string) {
  const rows: string[] = [`${rel}/`]
  await walk(abs, '', 0, rows)
  return rows.join('\n')
}

async function walk(dir: string, prefix: string, depth: number, rows: string[]) {
  if (depth >= 2) return
  const entries = (await readdir(dir, { withFileTypes: true }))
    .filter((entry) => !entry.name.startsWith('.'))
    .sort((a, b) => a.name.localeCompare(b.name))
  for (const entry of entries) {
    const label = entry.isDirectory() ? `${entry.name}/` : entry.name
    rows.push(`${prefix}- ${label}`)
    if (entry.isDirectory()) await walk(join(dir, entry.name), `${prefix}  `, depth + 1, rows)
  }
}

function countOccurrences(haystack: string, needle: string) {
  if (!needle) return 0
  let count = 0
  let from = 0
  while (true) {
    const idx = haystack.indexOf(needle, from)
    if (idx === -1) break
    count += 1
    from = idx + needle.length
  }
  return count
}

async function exists(abs: string) {
  try {
    await access(abs, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function safeStat(abs: string) {
  try {
    return await stat(abs)
  } catch {
    return null
  }
}

function truncate(text: string) {
  if (text.length <= MAX_OUTPUT) return text
  return `${text.slice(0, MAX_OUTPUT)}\n<response clipped>`
}

export const STR_REPLACE_EDITOR_DESCRIPTION = [
  'Custom editing tool for viewing, creating and editing files',
  '* State is persistent across command calls and discussions with the user',
  '* If `path` is a file, `view` displays the result of applying `cat -n`. If `path` is a directory, `view` lists non-hidden files and directories up to 2 levels deep',
  '* The `create` command cannot be used if the specified `path` already exists as a file',
  '* Paths are resolved inside the workspace (relative or absolute under the workspace root)',
  '',
  'Notes for using the `str_replace` command:',
  '* The `old_str` parameter should match EXACTLY one or more consecutive lines from the original file. Be mindful of whitespaces!',
  '* If the `old_str` parameter is not unique in the file, the replacement will not be performed. Make sure to include enough context in `old_str` to make it unique',
  '* The `new_str` parameter should contain the edited lines that should replace the `old_str`',
].join('\n')

export const STR_REPLACE_EDITOR_PARAMETERS = {
  type: 'object',
  properties: {
    command: {
      type: 'string',
      description: 'The commands to run. Allowed options are: `view`, `create`, `str_replace`, `insert`.',
      enum: ['view', 'create', 'str_replace', 'insert'],
    },
    path: {
      type: 'string',
      description: 'Path to file or directory inside the workspace, e.g. `src/app.ts` or an absolute path under the workspace root.',
    },
    file_text: {
      type: 'string',
      description: 'Required parameter of `create` command, with the content of the file to be created.',
    },
    insert_line: {
      type: 'integer',
      description: 'Required parameter of `insert` command. The `new_str` will be inserted AFTER the line `insert_line` of `path`.',
    },
    new_str: {
      type: 'string',
      description:
        'Optional parameter of `str_replace` command containing the new string (if not given, no string will be added). Required parameter of `insert` command containing the string to insert.',
    },
    old_str: {
      type: 'string',
      description: 'Required parameter of `str_replace` command containing the string in `path` to replace.',
    },
    view_range: {
      type: 'array',
      description:
        'Optional parameter of `view` command when `path` points to a file. If none is given, the full file is shown. If provided, the file will be shown in the indicated line number range, e.g. [11, 12] will show lines 11 and 12. Indexing at 1 to start. Setting `[start_line, -1]` shows all lines from `start_line` to the end of the file.',
      items: { type: 'integer' },
    },
  },
  required: ['command', 'path'],
} as const
