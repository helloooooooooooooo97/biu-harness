/**
 * CLI 入口。
 *
 * 用法：
 *   DEEPSEEK_API_KEY=sk-... npm start -- --prompt "你好"
 *   MOCK_LLM=1 npm start -- --prompt "你好"      # 无 key 演示
 *   echo "你好" | npm start                      # 从 stdin 读取
 *   npm start -- --prompt "继续" --history history.json
 */
import { readFileSync } from 'node:fs'
import { AgentV1 } from './agent-v1.ts'
import type { ChatMessage } from './chat-client.ts'

function readArg(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag)
  return index >= 0 ? argv[index + 1] : undefined
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

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const prompt = readArg(argv, '--prompt')
  const model = readArg(argv, '--model')
  const historyFile = readArg(argv, '--history')
  const history: ChatMessage[] = historyFile
    ? JSON.parse(readFileSync(historyFile, 'utf8')) as ChatMessage[]
    : []
  const input = prompt ?? (await readStdin()).trim()

  if (!input) {
    console.error('用法: npm start -- --prompt "你好"（或从 stdin 传入）')
    process.exit(1)
  }

  try {
    const { reply } = await new AgentV1({ model }).run(input, history)
    console.log(reply)
  } catch (err) {
    console.error(`✘ ${err instanceof Error ? err.message : String(err)}`)
    process.exitCode = 1
  }
}

void main()
