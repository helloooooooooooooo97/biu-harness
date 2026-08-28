import { existsSync } from 'node:fs'
import { join } from 'node:path'

export type PosixShellPlatform = NodeJS.Platform
export type HostShellKind = 'sh' | 'git-bash' | 'cmd'

function gitBashCandidates(env: NodeJS.ProcessEnv): string[] {
  const programFiles = env.ProgramFiles || env.PROGRAMFILES || 'C:\\Program Files'
  const programW6432 = env.ProgramW6432 || programFiles
  const local = env.LOCALAPPDATA || ''
  const list = [
    env.BIU_SHELL,
    join(programFiles, 'Git', 'bin', 'bash.exe'),
    join(programW6432, 'Git', 'bin', 'bash.exe'),
    local ? join(local, 'Programs', 'Git', 'bin', 'bash.exe') : '',
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
  ]
  return list.filter((item): item is string => Boolean(item))
}

function isCmd(bin: string) {
  return /(?:^|[\\/])cmd\.exe$/i.test(bin)
}

/** Windows 优先 Git Bash；没有则退回 cmd.exe。Unix 仍用 /bin/sh。 */
export function posixShellBin(platform: PosixShellPlatform = process.platform, env: NodeJS.ProcessEnv = process.env): string {
  if (platform !== 'win32') return '/bin/sh'
  for (const candidate of gitBashCandidates(env)) {
    if (existsSync(candidate)) return candidate
  }
  return env.ComSpec || env.COMSPEC || 'cmd.exe'
}

export function posixShellArgv(
  command: string,
  platform: PosixShellPlatform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const bin = posixShellBin(platform, env)
  if (platform === 'win32' && isCmd(bin)) return [bin, '/d', '/s', '/c', command]
  return [bin, '-c', command]
}

export function hostShellKind(
  platform: PosixShellPlatform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): HostShellKind {
  if (platform !== 'win32') return 'sh'
  return isCmd(posixShellBin(platform, env)) ? 'cmd' : 'git-bash'
}

/** 给 system prompt：按当前 OS/shell 告诉模型该怎么写命令。 */
export function describeHostRuntime(
  platform: PosixShellPlatform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const kind = hostShellKind(platform, env)
  if (kind === 'sh') {
    const os = platform === 'darwin' ? 'macOS' : 'Linux'
    return `当前 host 运行在 ${os}。bash 工具已自动接到 /bin/sh -c，请用 POSIX 命令（ls、pwd、python3）。`
  }
  if (kind === 'git-bash') {
    return '当前 host 运行在 Windows，已自动检测到 Git Bash。bash 工具按 POSIX 写（ls、pwd、python）；路径可用正斜杠。'
  }
  return '当前 host 运行在 Windows，未检测到 Git Bash，bash 工具已自动改走 cmd.exe /c。不要用 ls/cat/rm，改用 dir/type/del；Python 用 python。装 Git for Windows 后会自动切回 bash。'
}
