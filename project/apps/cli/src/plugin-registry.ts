/**
 * 插件目录加载器：plugins/<name>/index.ts 里的插件自动被发现。
 *
 * - install(name) 的本质 = import() 这个目录的 index.ts；
 * - 热更新时带 ?t= 时间戳破 import 缓存，重新 import 同一文件。
 * - 目录支持一层分组：plugins/registry/<name>/index.ts（注册类插件），
 *   分组目录本身没有 index.ts，会被递归展开。
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { Plugin } from '@deepseek-ai/cordis'
import type { ConfigEntry } from '@mini-dsh/config'

export const PLUGINS_DIR = fileURLToPath(new URL('../plugins', import.meta.url))

export type CordisPlugin = Plugin<unknown>

export const DEFAULT_ENTRIES: ConfigEntry[] = [
  { id: 's', name: 'session' },
  { id: 'tel', name: 'telemetry' },
  { id: 'cn', name: 'cancellation' },
  { id: 'cp', name: 'compaction' },
  { id: 'g', name: 'guard' },
  { id: 'sk', name: 'skills' },
  { id: 'sk-cs', name: 'skill-code-style' },
  { id: 'pr', name: 'presets' },
  { id: 'pr-coding', name: 'preset-coding' },
  { id: 'llm', name: 'llm-mock' },
  { id: 't', name: 'tools' },
  { id: 't-echo', name: 'tool-echo' },
  { id: 't-skill', name: 'tool-skill' },
  { id: 't-write', name: 'tool-write-file' },
  { id: 'p', name: 'prompt' },
  { id: 'p-id', name: 'prompt-identity' },
  { id: 'p-tools', name: 'prompt-tools' },
  { id: 'sa', name: 'subagents' },
  { id: 'sa-ip', name: 'subagent-inprocess' },
  { id: 'wf', name: 'workflow' },
  { id: 'loop', name: 'agent-loop' },
  { id: 'h', name: 'headless' },
  { id: 'rpc', name: 'rpc' },
]

export const DEFAULT_CONFIG = JSON.stringify({ entries: DEFAULT_ENTRIES })

/** 递归收集所有「含 index.ts 的插件目录」的绝对路径。 */
function scanPluginDirs(): string[] {
  const dirs: string[] = []
  const walk = (dir: string): void => {
    for (const d of readdirSync(dir, { withFileTypes: true })) {
      if (!d.isDirectory()) continue
      const sub = join(dir, d.name)
      if (existsSync(join(sub, 'index.ts'))) dirs.push(sub)
      else walk(sub) // 分组目录（如 registry/）没有 index.ts，继续下钻
    }
  }
  walk(PLUGINS_DIR)
  return dirs
}

/** 按插件名找到它的目录（支持分组目录）。 */
function findPluginDir(name: string): string | undefined {
  return scanPluginDirs().find((dir) => basename(dir) === name)
}

/** 按名字加载一个插件目录；bust=true 时带时间戳破 import 缓存（热更新用）。 */
export async function loadPluginModule(name: string, bust = false): Promise<CordisPlugin> {
  const dir = findPluginDir(name)
  if (!dir) throw new Error(`插件目录不存在: ${name}`)
  const file = join(dir, 'index.ts')
  const url = pathToFileURL(file).href + (bust ? `?t=${Date.now()}` : '')
  const mod = (await import(url)) as { plugin?: CordisPlugin; default?: CordisPlugin }
  const def = mod.plugin ?? mod.default
  if (!def) throw new Error(`插件 ${name} 缺少 plugin 导出`)
  return def
}

/** 扫描 plugins/ 目录，返回 name → plugin。 */
export async function loadAllPlugins(): Promise<Map<string, CordisPlugin>> {
  const map = new Map<string, CordisPlugin>()
  for (const dir of scanPluginDirs()) {
    const name = basename(dir)
    const def = await loadPluginModule(name)
    map.set(def.name ?? name, def)
  }
  return map
}

/** 插件目录 + index.ts 的 mtime 快照，供 watchPlugins 轮询。 */
export function listPluginFiles(): Array<{ name: string; mtimeMs: number }> {
  return scanPluginDirs().map((dir) => ({
    name: basename(dir),
    mtimeMs: statSync(join(dir, 'index.ts')).mtimeMs,
  }))
}
