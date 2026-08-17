/**
 * MiniDshWorkspace：生成 monorepo 骨架（第 19 课起填充接口与实现）。
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const PACKAGES = [
  'llm',
  'llm-deepseek',
  'core-session',
  'core-tools',
  'core-agent-loop',
  'core-system-prompt',
] as const

const APPS = ['cli'] as const

export class MiniDshWorkspace {
  private readonly root: string

  constructor(dir: string) {
    this.root = resolve(dir)
  }

  async scaffold(): Promise<void> {
    await mkdir(this.root, { recursive: true })
    await writeFile(resolve(this.root, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'\n  - 'apps/*'\n")
    await writeFile(resolve(this.root, 'package.json'), JSON.stringify({
      name: 'mini-dsh',
      version: '0.0.0',
      private: true,
      type: 'module',
      packageManager: 'pnpm@10.0.0',
      scripts: { build: 'pnpm -r build', test: 'pnpm -r test' },
    }, null, 2) + '\n')
    await writeFile(resolve(this.root, 'tsconfig.base.json'), JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        strict: true,
        skipLibCheck: true,
        esModuleInterop: true,
      },
    }, null, 2) + '\n')
    for (const name of PACKAGES) {
      await this.writePackage(name, 'packages', name === 'llm-deepseek' ? ['@deepseek-ai/cordis'] : [])
    }
    for (const name of APPS) {
      await this.writePackage(name, 'apps', ['@mini-dsh/core-agent-loop'])
    }
  }

  private async writePackage(name: string, scope: string, deps: string[]): Promise<void> {
    const dir = resolve(this.root, scope, name)
    await mkdir(resolve(dir, 'src'), { recursive: true })
    await writeFile(resolve(dir, 'package.json'), JSON.stringify({
      name: `@mini-dsh/${name}`,
      version: '0.0.0',
      private: true,
      type: 'module',
      main: 'src/index.ts',
      dependencies: Object.fromEntries(deps.map((dep) => [dep, '0.1.0-rc.5'])),
      scripts: { build: 'tsc --noEmit', test: 'node --test' },
    }, null, 2) + '\n')
    await writeFile(resolve(dir, 'tsconfig.json'), JSON.stringify({
      extends: '../../tsconfig.base.json',
      compilerOptions: { noEmit: true },
      include: ['src'],
    }, null, 2) + '\n')
    await writeFile(resolve(dir, 'src/index.ts'), `// ${name}：第 19 课起填充实现。\n`)
  }
}
