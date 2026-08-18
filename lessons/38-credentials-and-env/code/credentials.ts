/** 凭据存储与脱敏（第 38 课）。 */

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

  remove(name: string): void {
    this.data.delete(name)
  }

  all(): Array<[string, string]> {
    return [...this.data.entries()]
  }
}

/** 把文本里出现的密钥替换成 ***。 */
export function redactSecrets(text: string, secrets: Iterable<string>): string {
  let out = text
  for (const secret of secrets) {
    if (!secret) continue
    out = out.split(secret).join('***')
  }
  return out
}
