/** subprocess 远程/沙箱 Provider：返回 canned 输出。 */
import type { SubprocessService } from './subprocess.ts'

export class SubprocessRemoteMock implements SubprocessService {
  constructor(private readonly canned = '远程执行') {}

  async exec(_command: string): Promise<string> {
    return this.canned
  }
}
