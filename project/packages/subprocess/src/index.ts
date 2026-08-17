/** subprocess 能力缝：定义 + 本地/远程两个 Provider（第 35 课）。 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

export interface SubprocessService {
  exec(command: string): Promise<string>
}

const execFileAsync = promisify(execFile)

export class SubprocessLocal implements SubprocessService {
  async exec(command: string): Promise<string> {
    const { stdout, stderr } = await execFileAsync('bash', ['-c', command], { timeout: 10_000 })
    return `${stdout}${stderr}`.trim()
  }
}

export class SubprocessRemoteMock implements SubprocessService {
  constructor(private readonly canned = '远程执行') {}

  async exec(_command: string): Promise<string> {
    return this.canned
  }
}
