/**
 * 插件加载器：plugins/<group>/<name>.ts —— 一个文件 = 一个插件，自动被发现。
 *
 * - install(name) 的本质 = import() 这个文件；
 * - 热更新时带 ?t= 时间戳破 import 缓存，重新 import 同一文件。
 * - 按类分组：registry/（注册类）、contributors/（贡献类）、
 *   infrastructure/（基础设施类）、orchestration/（编排入口类）。
 */
import { readdirSync, statSync } from 'node:fs'
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

/** 递归收集 plugins/ 下所有插件文件（每个 .ts 文件 = 一个插件）。 */
function scanPluginFiles(): string[] {
  const files: string[] = []
  const walk = (dir: string): void => {
    for (const d of readdirSync(dir, { withFileTypes: true })) {
      const sub = join(dir, d.name)
      if (d.isDirectory()) walk(sub)
      else if (d.name.endsWith('.ts')) files.push(sub)
    }
  }
  walk(PLUGINS_DIR)
  return files
}

/** 按插件名找到它的文件（文件 basename 去掉 .ts = 插件名）。 */
function findPluginFile(name: string): string | undefined {
  return scanPluginFiles().find((file) => basename(file, '.ts') === name)
}

/** 按名字加载一个插件文件；bust=true 时带时间戳破 import 缓存（热更新用）。 */
export async function loadPluginModule(name: string, bust = false): Promise<CordisPlugin> {
  const file = findPluginFile(name)
  if (!file) throw new Error(`插件文件不存在: ${name}`)
  const url = pathToFileURL(file).href + (bust ? `?t=${Date.now()}` : '')
  const mod = (await import(url)) as { plugin?: CordisPlugin; default?: CordisPlugin }
  const def = mod.plugin ?? mod.default
  if (!def) throw new Error(`插件 ${name} 缺少 plugin 导出`)
  return def
}

/** 扫描 plugins/ 文件，返回 name → plugin。 */
export async function loadAllPlugins(): Promise<Map<string, CordisPlugin>> {
  const map = new Map<string, CordisPlugin>()
  for (const file of scanPluginFiles()) {
    const name = basename(file, '.ts')
    const def = await loadPluginModule(name)
    map.set(def.name ?? name, def)
  }
  return map
}

/** 插件文件 + mtime 快照，供 watchPlugins 轮询。 */
export function listPluginFiles(): Array<{ name: string; mtimeMs: number }> {
  return scanPluginFiles().map((file) => ({
    name: basename(file, '.ts'),
    mtimeMs: statSync(file).mtimeMs,
  }))
}
