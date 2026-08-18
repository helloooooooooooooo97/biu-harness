/** profile/bundle/patch 分层组装（第 37 课）。 */

export interface ConfigEntry {
  id: string
  name: string
  enabled?: boolean
  config?: Record<string, unknown>
}

export interface PatchEntry {
  id?: string
  replace?: Partial<ConfigEntry> & { config?: Record<string, unknown> }
  insert?: ConfigEntry[]
}

export interface BundleManifest {
  name: string
  patch: ConfigEntry[]
}

export interface ProfileManifest {
  name: string
  bundles: string[]
  patch?: PatchEntry[]
}

export function applyPatch(entries: ConfigEntry[], patches: PatchEntry[]): ConfigEntry[] {
  let out = [...entries]
  for (const patch of patches) {
    if (patch.insert) out = [...out, ...patch.insert]
    if (patch.id && patch.replace) {
      const index = out.findIndex((e) => e.id === patch.id)
      if (index < 0) throw new Error(`patch 目标不存在: ${patch.id}`)
      out[index] = { ...out[index], ...patch.replace }
    }
  }
  return out
}

export function composeProfile(profile: ProfileManifest, bundles: Map<string, BundleManifest>): ConfigEntry[] {
  let entries: ConfigEntry[] = []
  for (const name of profile.bundles) {
    const bundle = bundles.get(name)
    if (!bundle) throw new Error(`未知 bundle: ${name}`)
    entries = [...entries, ...bundle.patch]
  }
  return applyPatch(entries, profile.patch ?? [])
}
