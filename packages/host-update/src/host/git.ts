import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export async function git(root: string, args: string[], timeoutMs = 60_000) {
  const { stdout, stderr } = await execFileAsync('git', args, {
    cwd: root,
    timeout: timeoutMs,
    encoding: 'utf8',
  })
  return { stdout: String(stdout).trim(), stderr: String(stderr).trim() }
}

export async function fetchMain(root: string) {
  await git(root, ['fetch', 'origin', 'main'])
}

/** 当前 HEAD 落后 origin/main 的提交数。 */
export async function behindMain(root: string): Promise<number> {
  const { stdout } = await git(root, ['rev-list', '--count', '--no-merges', 'HEAD..origin/main'])
  const n = Number.parseInt(stdout, 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export async function mergeMain(root: string) {
  await git(root, ['merge', 'origin/main', '--no-edit'])
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
