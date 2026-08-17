/**
 * 生成 mini-dsh monorepo 骨架（TS + OOD 版，第 18 课起填充实现）。
 *
 * 用法：
 *   npm start                       # 生成到 ./project
 *   npm start -- --dir <path>       # 指定目录
 *   npm start -- --dry-run          # 只打印结构，不落盘
 */
import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export interface ScaffoldOptions {
  dir: string
  dryRun?: boolean
}

const PACKAGES = [
  'core-session', 'core-agent-loop', 'core-tools', 'core-system-prompt',
  'llm', 'llm-deepseek', 'tool-fs', 'tool-bash',
  'approval', 'guard', 'credentials', 'compaction-basic',
  'subagent-inprocess', 'workflow', 'telemetry', 'config', 'preset-minimal',
] as const

const APPS = ['cli', 'web', 'server'] as const

/** 负责生成 mini-dsh workspace 骨架的类。 */
export class MonorepoScaffolder {
  private readonly root: string

  constructor(private readonly options: ScaffoldOptions) {
    this.root = resolve(options.dir)
  }

  async run(): Promise<void> {
    if (this.options.dryRun) {
      this.printTree()
      return
    }
    await this.assertEmpty()
    await mkdir(this.root, { recursive: true })
    await this.writeRootFiles()
    for (const name of PACKAGES) {
      await this.writePackage(name, 'packages')
    }
    for (const name of APPS) {
      await this.writePackage(name, 'apps')
    }
    console.log(`✔ 骨架已生成: ${this.root}`)
    console.log(`  下一步: cd ${this.options.dir} && pnpm install`)
  }

  private async assertEmpty(): Promise<void> {
    try {
      const entries = await readdir(this.root)
      if (entries.length > 0) {
        throw new Error(`目录非空，拒绝覆盖: ${this.root}`)
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    }
  }

  private async writeRootFiles(): Promise<void> {
    const files: Record<string, string> = {
      'package.json': JSON.stringify({
        name: 'mini-dsh',
        version: '0.0.0',
        private: true,
        type: 'module',
        packageManager: 'pnpm@10.0.0',
        scripts: { build: 'pnpm -r build', test: 'pnpm -r test' },
      }, null, 2) + '\n',
      'pnpm-workspace.yaml': "packages:\n  - 'packages/*'\n  - 'apps/*'\n",
      'tsconfig.base.json': JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          strict: true,
          skipLibCheck: true,
          esModuleInterop: true,
          resolveJsonModule: true,
        },
      }, null, 2) + '\n',
      '.gitignore': 'node_modules/\ndist/\ncoverage/\n*.log\n.env\n.env.*\n!.env.example\n.DS_Store\n',
      'README.md': '# mini-dsh\n\n课程主工程：从零到一复现 DeepSeek Harness。\n\n- 第 13-17 课：手写 mini-Cordis 内核。\n- 第 18 课：换装真实 `@deepseek-ai/cordis`，包边界就绪。\n- 每完成一课打 tag：`lesson-18` … `lesson-53`。\n\n> 当前为骨架，实现从第 18 课开始逐课填充。\n',
    }
    for (const [rel, content] of Object.entries(files)) {
      await writeFile(resolve(this.root, rel), content)
    }
  }

  private async writePackage(name: string, scope: string): Promise<void> {
    const dir = resolve(this.root, scope, name)
    await mkdir(resolve(dir, 'src'), { recursive: true })
    await writeFile(resolve(dir, 'package.json'), JSON.stringify({
      name: `@mini-dsh/${name}`,
      version: '0.0.0',
      private: true,
      type: 'module',
      main: 'src/index.ts',
      scripts: { build: 'tsc --noEmit', test: 'node --test' },
    }, null, 2) + '\n')
    await writeFile(resolve(dir, 'src/index.ts'), `// ${name} 占位实现：第 18 课起逐课填充。\nexport const name = '${name}';\n`)
    await writeFile(resolve(dir, 'README.md'), `# @mini-dsh/${name}\n\nTODO：本包职责与实现，见 syllabus 对应课程。\n`)
  }

  private printTree(): void {
    const branch = (name: string): string => `│   ├── ${name}/{package.json,src/index.ts,README.md}`
    console.log(`${this.options.dir}/`)
    console.log('├── package.json')
    console.log('├── pnpm-workspace.yaml')
    console.log('├── tsconfig.base.json')
    console.log('├── .gitignore')
    console.log('├── README.md')
    console.log('├── packages/')
    for (const p of PACKAGES) console.log(branch(p))
    console.log('└── apps/')
    for (const a of APPS) console.log(`    ├── ${a}/{package.json,src/index.ts,README.md}`)
  }
}

function parseArgs(argv: string[]): ScaffoldOptions {
  const options: ScaffoldOptions = { dir: 'project' }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dir') options.dir = argv[i + 1]
    else if (argv[i] === '--dry-run') options.dryRun = true
    else if (argv[i] === '--help') {
      console.log('用法: npm start -- [--dir <path>] [--dry-run]')
      process.exit(0)
    }
  }
  return options
}

const isMain = process.argv[1]
  && import.meta.url === new URL(process.argv[1], 'file:').href
if (isMain) {
  new MonorepoScaffolder(parseArgs(process.argv.slice(2)))
    .run()
    .catch((err: unknown) => {
      console.error(`✘ ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    })
}
