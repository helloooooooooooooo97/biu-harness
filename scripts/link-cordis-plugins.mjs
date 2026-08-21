#!/usr/bin/env node
/**
 * 按 cordis.plugins.json 把 packages/* 链到 node_modules。
 * 根 package.json 不写死任何插件包名。
 */
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function readPlugins() {
  const path = join(root, 'cordis.plugins.json')
  if (!existsSync(path)) return []
  const body = JSON.parse(readFileSync(path, 'utf8'))
  return Array.isArray(body.plugins) ? body.plugins : []
}

function findPkg(name) {
  const base = join(root, 'packages')
  if (!existsSync(base)) return null
  for (const dir of readdirSync(base)) {
    const pkgFile = join(base, dir, 'package.json')
    if (!existsSync(pkgFile)) continue
    try {
      const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'))
      if (pkg.name === name) return join(base, dir)
    } catch {
      /* skip */
    }
  }
  return null
}

const names = new Set()
for (const item of readPlugins()) {
  if (item.package) names.add(item.package)
  if (item.ui) names.add(item.ui)
}

for (const name of names) {
  const dir = findPkg(name)
  if (!dir) {
    console.warn(`[link-cordis-plugins] missing packages/* for ${name}`)
    continue
  }
  const linkPath = join(root, 'node_modules', ...String(name).split('/'))
  mkdirSync(dirname(linkPath), { recursive: true })
  if (existsSync(linkPath)) {
    try {
      if (lstatSync(linkPath).isSymbolicLink()) rmSync(linkPath)
      else continue
    } catch {
      continue
    }
  }
  symlinkSync(dir, linkPath, 'dir')
  console.log(`[link-cordis-plugins] ${name} -> ${dir}`)
}
