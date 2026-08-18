/** 环境分层与凭据（第 38 课）。 */

export function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return out
}

export function loadLayeredEnv(files: string[], inherited: Record<string, string>): Record<string, string> {
  const merged: Record<string, string> = {}
  for (const text of files) Object.assign(merged, parseEnv(text))
  return { ...merged, ...inherited }
}

export class CredentialsStore {
  private readonly data = new Map<string, string>()

  set(name: string, value: string): void {
    this.data.set(name, value)
  }

  get(name: string): string | undefined {
    return this.data.get(name)
  }

  has(name: string): boolean {
    return this.data.has(name)
  }
}

export function redactSecrets(text: string, secrets: Iterable<string>): string {
  let out = text
  for (const secret of secrets) {
    if (!secret) continue
    out = out.split(secret).join('***')
  }
  return out
}
