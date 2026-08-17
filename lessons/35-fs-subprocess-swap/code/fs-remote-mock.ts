/** fs 远程/沙箱 Provider：内存 map 模拟远程文件系统。 */
import type { FsService } from './fs.ts'

export class FsRemoteMock implements FsService {
  private readonly files = new Map<string, string>()

  async readFile(path: string): Promise<string> {
    const content = this.files.get(path)
    if (content === undefined) throw new Error(`远程文件不存在: ${path}`)
    return content
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(path, content)
  }

  async list(dir: string): Promise<string[]> {
    return [...this.files.keys()]
      .filter((p) => p.startsWith(`${dir}/`))
      .map((p) => p.slice(dir.length + 1))
  }
}
