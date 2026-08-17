/** fs 本地 Provider：真实磁盘。 */
import { readFile, readdir, writeFile } from 'node:fs/promises'
import type { FsService } from './fs.ts'

export class FsLocal implements FsService {
  async readFile(path: string): Promise<string> {
    return readFile(path, 'utf8')
  }

  async writeFile(path: string, content: string): Promise<void> {
    await writeFile(path, content, 'utf8')
  }

  async list(dir: string): Promise<string[]> {
    return readdir(dir)
  }
}
