/** Skills 子系统：Skill / Provider / Registry（第 41 课）。 */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface Skill {
  name: string
  description: string
  content?: string
}

export interface SkillProvider {
  list(): Promise<Skill[]>
  load(name: string): Promise<string | undefined>
}

export class SkillRegistry {
  private readonly providers: SkillProvider[] = []

  register(provider: SkillProvider): () => void {
    this.providers.push(provider)
    return () => {
      const index = this.providers.indexOf(provider)
      if (index >= 0) this.providers.splice(index, 1)
    }
  }

  async list(): Promise<Skill[]> {
    const lists = await Promise.all(this.providers.map((p) => p.list()))
    return lists.flat()
  }

  async load(name: string): Promise<string | undefined> {
    for (const provider of this.providers) {
      const content = await provider.load(name)
      if (content !== undefined) return content
    }
    return undefined
  }
}

/** 文件系统 provider：技能 = 目录里的 .md 文件。 */
export class FilesystemSkillProvider implements SkillProvider {
  constructor(private readonly dir: string) {}

  async list(): Promise<Skill[]> {
    const files = await readdir(this.dir)
    return files
      .filter((f) => f.endsWith('.md'))
      .map((f) => ({ name: f.slice(0, -3), description: `技能: ${f.slice(0, -3)}` }))
  }

  async load(name: string): Promise<string | undefined> {
    try {
      return await readFile(join(this.dir, `${name}.md`), 'utf8')
    } catch {
      return undefined
    }
  }
}
