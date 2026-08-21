import { copyFile, mkdir, readFile, access } from 'node:fs/promises'
import { basename, extname, isAbsolute, join, resolve, relative } from 'node:path'
import { constants } from 'node:fs'

export const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'])

export type ArtifactMeta = {
  name: string
  mime: string
  url: string
  source?: string
}

const PATH_CANDIDATE =
  /(?:^|[\s"'=`(,\[{])((?:\/|\.\/|\.\.\/)?[^\s"'`)\]},;]+?\.(?:png|jpe?g|gif|webp|svg))\b/gi

export function artifactsDir(sessionId: string, baseDir = process.cwd()) {
  return join(baseDir, '.cordis', 'artifacts', sessionId)
}

export function artifactMime(name: string) {
  switch (extname(name).toLowerCase()) {
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.gif':
      return 'image/gif'
    case '.webp':
      return 'image/webp'
    case '.svg':
      return 'image/svg+xml'
    default:
      return 'application/octet-stream'
  }
}

export function isImagePath(path: string) {
  return IMAGE_EXTENSIONS.has(extname(path).toLowerCase())
}

/** 从 bash stdout/stderr 里抠出看起来像图片路径的片段。 */
export function extractImagePathCandidates(text: string): string[] {
  if (!text) return []
  const found: string[] = []
  const seen = new Set<string>()
  for (const match of text.matchAll(PATH_CANDIDATE)) {
    const raw = match[1]?.trim()
    if (!raw || seen.has(raw)) continue
    seen.add(raw)
    found.push(raw)
  }
  return found
}

function safeArtifactName(sourcePath: string, used: Set<string>) {
  const base = basename(sourcePath).replace(/[^\w.\-]+/g, '_') || 'image.png'
  const ext = extname(base) || '.png'
  const stem = basename(base, ext) || 'image'
  let name = `${stem}${ext}`
  let i = 1
  while (used.has(name)) {
    name = `${stem}-${i}${ext}`
    i += 1
  }
  used.add(name)
  return name
}

async function fileExists(path: string) {
  try {
    await access(path, constants.R_OK)
    return true
  } catch {
    return false
  }
}

/** 将工作区内的图片复制到 `.cordis/artifacts/<sessionId>/`，返回可给前端用的元数据。 */
export async function ingestSessionImages(options: {
  sessionId: string
  candidates: string[]
  workspaceRoot: string
  baseDir?: string
}): Promise<ArtifactMeta[]> {
  const { sessionId, candidates, workspaceRoot } = options
  const baseDir = options.baseDir ?? process.cwd()
  if (!sessionId || candidates.length === 0) return []

  const root = resolve(workspaceRoot)
  const dir = artifactsDir(sessionId, baseDir)
  await mkdir(dir, { recursive: true })

  const used = new Set<string>()
  const out: ArtifactMeta[] = []

  for (const candidate of candidates) {
    const full = isAbsolute(candidate) ? resolve(candidate) : resolve(root, candidate)
    const rel = relative(root, full)
    if (rel.startsWith('..') || !isImagePath(full)) continue
    if (!(await fileExists(full))) continue

    const name = safeArtifactName(full, used)
    const dest = join(dir, name)
    await copyFile(full, dest)
    out.push({
      name,
      mime: artifactMime(name),
      url: `/api/sessions/${encodeURIComponent(sessionId)}/artifacts/${encodeURIComponent(name)}`,
      source: rel || basename(full),
    })
  }

  return out
}

/** 解析并校验 artifact 文件路径；非法或穿越返回 null。 */
export function resolveArtifactFile(sessionId: string, name: string, baseDir = process.cwd()) {
  if (!sessionId || !name) return null
  if (name.includes('/') || name.includes('\\') || name.includes('..')) return null
  if (!/^[\w.\-]+$/.test(name)) return null
  const dir = artifactsDir(sessionId, baseDir)
  const full = join(dir, name)
  if (relative(dir, full).startsWith('..')) return null
  return full
}

export async function readArtifactFile(sessionId: string, name: string, baseDir = process.cwd()) {
  const full = resolveArtifactFile(sessionId, name, baseDir)
  if (!full) return null
  try {
    const data = await readFile(full)
    return { path: full, data, mime: artifactMime(name) }
  } catch {
    return null
  }
}
