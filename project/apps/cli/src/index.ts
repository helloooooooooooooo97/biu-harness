/**
 * mini-dsh CLI：装配全部包，用 mock LLM 跑一个完整回合（离线演示）。
 */
import { MessageDeriver, SessionLog } from '@mini-dsh/core-session'
import { EchoTool, MemoryTools } from '@mini-dsh/core-tools'
import { FixtureStore, MockLlm } from '@mini-dsh/llm-deepseek'
import { SECTION_ORDER, SystemPromptAssembler } from '@mini-dsh/core-system-prompt'
import { Agent, PreStepBus, TurnRunner } from '@mini-dsh/core-agent-loop'

export function createMiniDsh() {
  const session = new SessionLog()
  const tools = new MemoryTools()
  tools.register(new EchoTool())

  const store = new FixtureStore([
    // pre-step 会把输入改写成 [系统] 前缀，mock 按模型实际看到的输入命中。
    { key: '[系统] 帮我 echo hi', content: '我来执行。', toolCalls: [{ id: 'c1', name: 'echo', arguments: '{"text":"hi"}' }] },
    { key: '[系统] 帮我 echo hi', content: '结果是 hi。' },
  ])
  const llm = new MockLlm(store)

  const prompt = new SystemPromptAssembler()
  prompt.section({ name: 'identity', order: SECTION_ORDER.HARNESS_IDENTITY, text: '你是 mini-dsh。' })
  prompt.section({ name: 'tools', order: SECTION_ORDER.TOOL_GUIDANCE, text: '- echo' })

  const pre = new PreStepBus()
  const agent = new Agent('main')
  const turn = new TurnRunner({ llm, session, tools })

  return { session, prompt, pre, agent, turn, deriver: new MessageDeriver() }
}

export async function runDemo(promptText = '帮我 echo hi'): Promise<{ reply: string; events: string[]; prompt: string }> {
  const app = createMiniDsh()
  app.agent.followup(promptText)
  const { turnInput } = app.agent.inbox.claimNextTurn()
  const input = turnInput?.content ?? promptText

  // pre-step 拦截（示例：给输入加系统前缀）
  app.pre.on((decision, _p, next) => {
    if (decision.kind === 'enter') {
      next({ kind: 'enter', messages: decision.messages.map((m) => ({ ...m, content: `[系统] ${m.content}` })) })
    }
  })
  const decision = app.pre.run({ messages: [{ id: 'm1', content: input }], turn: 1, step: 1 })
  const entered = decision.kind === 'enter' ? decision.messages[0].content : input

  const result = await app.turn.run(entered)
  return {
    reply: result.reply,
    events: app.session.all.map((e) => e.kind),
    prompt: app.prompt.assemble({ variables: {} }),
  }
}

const isMain = process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href
if (isMain) {
  runDemo(process.argv[2])
    .then(({ reply, events, prompt }) => {
      console.log(`== 系统提示词 ==\n${prompt}\n`)
      console.log(`== 会话事件 ==\n${events.join(' → ')}\n`)
      console.log(`== 最终回答 ==\n${reply}`)
    })
    .catch((err: unknown) => {
      console.error(`✘ ${err instanceof Error ? err.message : String(err)}`)
      process.exitCode = 1
    })
}
