/**
 * CLI 入口：边收边打印的流式输出。
 *
 * 用法：
 *   DEEPSEEK_API_KEY=sk-... npm start -- --prompt "写一首诗"
 *   MOCK_LLM=1 npm start -- --prompt "你好"
 */
import { ChatClient } from './chat-client.ts'

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const prompt = readArg(argv, '--prompt')
  const input = prompt ?? (await readStdin()).trim()
  if (!input) {
    console.error('用法: npm start -- --prompt "..."（或从 stdin 传入）')
    process.exit(1)
  }

  const controller = new AbortController()
  process.on('SIGINT', () => controller.abort())

  try {
    let stopReason = 'stop'
    const client = new ChatClient()
    for await (const event of client.streamChat([{ role: 'user', content: input }], { signal: controller.signal })) {
      if (event.type === 'text') process.stdout.write(event.text)
      else stopReason = event.reason
    }
    process.stdout.write(`\n（finish_reason: ${stopReason}）\n`)
  } catch (err) {
    console.error(`\n✘ ${err instanceof Error ? err.message : String(err)}`)
    process.exitCode = 1
  }
}

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

void main()
