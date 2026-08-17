/** 消费者：ToolExecutor 只依赖 fs 与 subprocess 接口。 */
import type { FsService } from './fs.ts'
import type { SubprocessService } from './subprocess.ts'

export interface ExecutorDeps {
  fs: FsService
  sub: SubprocessService
}

export class ToolExecutor {
  constructor(private readonly deps: ExecutorDeps) {}

  async read(path: string): Promise<string> {
    return this.deps.fs.readFile(path)
  }

  async write(path: string, content: string): Promise<void> {
    await this.deps.fs.writeFile(path, content)
  }

  async run(command: string): Promise<string> {
    return this.deps.sub.exec(command)
  }
}
