import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { DATA_DIR_NAME, dataPath } from '@biu/host-plugin-loader/data-dir'

export const FILE_SYSTEM_ASSETS = `${DATA_DIR_NAME}/assets`
export const FILE_SYSTEM_ASSET_PREFIX = '/api/db/file/'

const ASSET_FILE_RE = /^[\p{L}\p{N}._-]+$/u

export function isAssetFileName(name: string) {
  const file = basename(name)
  return Boolean(file) && file === name.replace(/\\/g, '/') && file !== '.gitkeep' && ASSET_FILE_RE.test(file)
}

export function assetHref(name: string) {
  return `${FILE_SYSTEM_ASSET_PREFIX}${encodeURIComponent(name)}`
}

export function mimeOfAsset(name: string) {
  const ext = name.toLowerCase().slice(name.lastIndexOf('.'))
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.svg') return 'image/svg+xml'
  if (ext === '.pdf') return 'application/pdf'
  if (ext === '.json') return 'application/json; charset=utf-8'
  if (ext === '.txt' || ext === '.md') return 'text/plain; charset=utf-8'
  return 'application/octet-stream'
}

export class FileSystemAssets {
  constructor(private dir = dataPath(process.cwd(), 'assets')) {}

  root() {
    return this.dir
  }

  async write(name: string, content: string | Buffer | Uint8Array) {
    const file = basename(name)
    if (!file || file !== name.replace(/\\/g, '/') || !isAssetFileName(file)) throw new Error('invalid asset')
    await mkdir(this.dir, { recursive: true })
    const bytes = typeof content === 'string' ? Buffer.from(content) : Buffer.from(content)
    await writeFile(join(this.dir, file), bytes)
    return { name: file, href: assetHref(file) }
  }

  async read(name: string, fallbackDirs: string[] = []) {
    const file = basename(name)
    if (!file || file !== name.replace(/\\/g, '/')) throw new Error('invalid asset')
    const dirs = [this.dir, ...fallbackDirs]
    let last: unknown
    for (const dir of dirs) {
      try {
        const bytes = await readFile(join(dir, file))
        return { bytes, type: mimeOfAsset(file) }
      } catch (error) {
        last = error
      }
    }
    throw last instanceof Error ? last : new Error('not found')
  }
}
