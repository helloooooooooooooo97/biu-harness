/** CLI：scaffold 生成骨架；check 校验重构是否完成。 */
import { MiniDshWorkspace } from './workspace.ts'
import { RefactorChecker } from './refactor.ts'

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const command = args[0] ?? 'scaffold'
  const dir = args[1] ?? 'project'
  if (command === 'scaffold') {
    await new MiniDshWorkspace(dir).scaffold()
    console.log(`✔ workspace 已生成: ${dir}`)
  } else if (command === 'check') {
    const missing = new RefactorChecker(dir).missing()
    if (missing.length === 0) {
      console.log('✔ 重构完成：所有目标文件已就位')
    } else {
      console.error('✘ 缺失文件：')
      for (const file of missing) console.error(`  - ${file}`)
      process.exitCode = 1
    }
  } else {
    console.error('用法: npm start -- <scaffold|check> [dir]')
    process.exit(1)
  }
}

void main()
