import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

export const DATA_DIR_NAME = '.biu'
export const LEGACY_DATA_DIR_NAME = '.cordis'

function mergeDir(src: string, dest: string) {
  mkdirSync(dest, { recursive: true })
  for (const name of readdirSync(src)) {
    const from = join(src, name)
    const to = join(dest, name)
    if (!existsSync(to)) {
      renameSync(from, to)
      continue
    }
    const fromStat = statSync(from)
    const toStat = statSync(to)
    if (fromStat.isDirectory() && toStat.isDirectory()) mergeDir(from, to)
  }
}

/** Rename leftover `.cordis` to `.biu`. If both exist, move unique files then drop the old dir. */
export function migrateDataDir(parent: string): string {
  const dest = join(parent, DATA_DIR_NAME)
  const src = join(parent, LEGACY_DATA_DIR_NAME)
  if (!existsSync(src)) return dest
  if (!existsSync(dest)) {
    renameSync(src, dest)
    return dest
  }
  mergeDir(src, dest)
  rmSync(src, { recursive: true, force: true })
  return dest
}

export function dataDir(parent = process.cwd()): string {
  return migrateDataDir(parent)
}

export function dataPath(parent = process.cwd(), ...parts: string[]): string {
  return join(dataDir(parent), ...parts)
}
