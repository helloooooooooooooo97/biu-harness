import { execFile, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/** 所有客户都从这份上游 main 拉更新，不跟本机 origin（可能是 fork / 私有镜像）绑定。 */
export const DEFAULT_UPDATE_REMOTE = 'https://github.com/helloooooooooooooo97/biu-harness.git'
export const DEFAULT_UPDATE_REF = 'main'

export function updateSource() {
  return {
    remote: process.env.BIU_UPDATE_REMOTE?.trim() || DEFAULT_UPDATE_REMOTE,
    ref: process.env.BIU_UPDATE_REF?.trim() || DEFAULT_UPDATE_REF,
  }
}

export async function git(root: string, args: string[], timeoutMs = 60_000) {
  const { stdout, stderr } = await execFileAsync('git', args, {
    cwd: root,
    timeout: timeoutMs,
    encoding: 'utf8',
  })
  return { stdout: String(stdout).trim(), stderr: String(stderr).trim() }
}

export async function gitAvailable(): Promise<boolean> {
  try {
    await execFileAsync('git', ['--version'], { timeout: 10_000, encoding: 'utf8' })
    return true
  } catch {
    return false
  }
}

export function isGitRepo(root: string) {
  return existsSync(join(root, '.git'))
}

async function hasHead(root: string) {
  try {
    await git(root, ['rev-parse', '--verify', 'HEAD'])
    return true
  } catch {
    return false
  }
}

/** 没有 git 仓库时先 init，这样 zip 分发的客户机也能从官方 main 拉更新。 */
export async function ensureGitRepo(root: string) {
  if (!(await gitAvailable())) {
    throw new Error('本机未安装 git，无法初始化仓库或拉取更新')
  }
  if (isGitRepo(root)) return
  try {
    await git(root, ['init', '-b', 'main'])
  } catch {
    await git(root, ['init'])
    await git(root, ['checkout', '-B', 'main']).catch(() => undefined)
  }
}

export async function fetchMain(root: string, remote = updateSource().remote, ref = updateSource().ref) {
  await ensureGitRepo(root)
  await git(root, ['fetch', remote, ref])
}

function parseCount(stdout: string) {
  const n = Number.parseInt(stdout, 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** 当前 HEAD 落后刚 fetch 下来的上游 tip（FETCH_HEAD）的提交数。 */
export async function behindMain(root: string): Promise<number> {
  if (!(await hasHead(root))) {
    const { stdout } = await git(root, ['rev-list', '--count', 'FETCH_HEAD'])
    return parseCount(stdout)
  }
  const { stdout } = await git(root, ['rev-list', '--count', 'HEAD..FETCH_HEAD'])
  return parseCount(stdout)
}

export async function mergeMain(root: string) {
  if (!(await hasHead(root))) {
    await git(root, ['checkout', '-B', 'main', 'FETCH_HEAD'])
    return
  }
  await git(root, ['merge', 'FETCH_HEAD', '--no-edit'])
}

export function scheduleRestart(root: string) {
  const child = spawn('make', ['restart'], {
    cwd: root,
    detached: true,
    stdio: 'ignore',
    env: process.env,
  })
  child.unref()
}
