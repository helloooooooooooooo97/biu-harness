/**
 * CLI 入口：按环境选 Provider。
 *   MOCK_LLM=1            → MockLlm（fixtures/ 录放，离线）
 *   DEEPSEEK_API_KEY=...  → ChatClient（真实）
 */
import { AgentV2 } from './agent-v2.ts'
import { ChatClient } from './chat-client.ts'
import { FixtureStore, MockLlm } from './mock-llm.ts'
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
    const client = process.env.MOCK_LLM === '1'
      ? new MockLlm(FixtureStore.fromFiles([
          new URL('./fixtures/hello.jsonl', import.meta.url).pathname,
          new URL('./fixtures/tool-call.jsonl', import.meta.url).pathname,
        ]))
      : new ChatClient()
    const agent = new AgentV2({ client, tools: [new EchoTool(), new BashTool()] })
    const { messages, steps } = await agent.run(input)
    console.log(messages.at(-1)?.content ?? '')
    console.error(`（${steps} 步，${process.env.MOCK_LLM === '1' ? 'mock' : 'real'}）`)
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
