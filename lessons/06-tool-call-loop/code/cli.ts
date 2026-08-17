/**
 * CLI 入口：装配 ToolRegistry（echo + bash）并跑一次工具循环。
 *
 * 用法：
 *   DEEPSEEK_API_KEY=sk-... npm start -- --prompt "运行 ls -la 并总结"
 *   MOCK_LLM=1 npm start -- --prompt "你好"
 */
import { AgentV2 } from './agent-v2.ts'
import { BashTool, EchoTool } from './tool.ts'

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const index = argv.indexOf('--prompt')
  const prompt = index >= 0 ? argv[index + 1] : undefined
  const input = prompt ?? (await readStdin()).trim()
  if (!input) {
    console.error('用法: npm start -- --prompt "..."（或从 stdin 传入）')
    process.exit(1)
  }
  try {
    const agent = new AgentV2({ tools: [new EchoTool(), new BashTool()] })
    const { messages, steps } = await agent.run(input)
    const reply = messages.at(-1)?.content ?? ''
    console.log(reply)
    console.error(`（${steps} 步）`)
  } catch (err) {
    console.error(`✘ ${err instanceof Error ? err.message : String(err)}`)
    process.exitCode = 1
  }
}

function readStdin(): Promise<string> {
  return new Promise((resolvePromise) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => {
      data += chunk
    })
    process.stdin.on('end', () => resolvePromise(data))
  })
}

void main()
