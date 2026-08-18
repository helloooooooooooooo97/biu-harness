/** 分层环境变量：继承 > 项目 .env > 用户 .env（第 38 课）。 */

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

/** files 从低到高（后者覆盖前者），inherited 最高。 */
export function loadLayeredEnv(files: string[], inherited: Record<string, string>): Record<string, string> {
  const merged: Record<string, string> = {}
  for (const text of files) Object.assign(merged, parseEnv(text))
  return { ...merged, ...inherited }
}
