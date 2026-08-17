/** fs 能力缝：定义 + 本地/远程两个 Provider（第 35 课）。 */
import { readFile as read, readdir, writeFile as write } from 'node:fs/promises'

export interface FsService {
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  list(dir: string): Promise<string[]>
}

export class FsLocal implements FsService {
  async readFile(path: string): Promise<string> {
    return read(path, 'utf8')
  }

  async writeFile(path: string, content: string): Promise<void> {
    await write(path, content, 'utf8')
  }

  async list(dir: string): Promise<string[]> {
    return readdir(dir)
  }
}

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
