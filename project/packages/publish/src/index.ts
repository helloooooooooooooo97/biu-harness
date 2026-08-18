/** 插件清单、打包与发布（第 51 课）。 */

export interface PluginManifest {
  name: string
  version: string
  exports?: Record<string, string>
  dsh?: {
    bundle?: { patch?: string }
    profile?: { bundles?: string[] }
  }
}

export function validateManifest(manifest: PluginManifest): void {
  if (!manifest.name || !manifest.version) throw new Error('清单必须含 name 与 version')
}

export class Packager {
  pack(manifest: PluginManifest, files: Map<string, string>): Map<string, string> {
    validateManifest(manifest)
    const out = new Map<string, string>(files)
    out.set('package.json', JSON.stringify({ ...manifest, private: false }, null, 2))
    if (!out.has('index.ts')) out.set('index.ts', `export const name = '${manifest.name}';\n`)
    return out
  }
}

export class Publisher {
  private readonly published = new Map<string, string>()

  publish(manifest: PluginManifest): void {
    validateManifest(manifest)
    const existing = this.published.get(manifest.name)
    if (existing && existing !== manifest.version) throw new Error(`版本冲突: ${manifest.name} 已发布 ${existing}`)
    this.published.set(manifest.name, manifest.version)
  }
}
