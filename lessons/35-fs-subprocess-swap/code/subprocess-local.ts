/** subprocess 本地 Provider：真实 bash 执行。 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { SubprocessService } from './subprocess.ts'

const execFileAsync = promisify(execFile)

export class SubprocessLocal implements SubprocessService {
  async exec(command: string): Promise<string> {
    const { stdout, stderr } = await execFileAsync('bash', ['-c', command], { timeout: 10_000 })
    return `${stdout}${stderr}`.trim()
  }
}
