import { useEffect, useState, type FormEvent } from 'react'
import type { SlotProps } from '../../registry/slots.ts'

type AgentMode = 'standard' | 'minimal'

interface ChatPublicConfig {
  provider: 'deepseek' | 'openai'
  model: string
  systemPrompt: string
  agentMode: AgentMode
  configured: boolean
  hint: string
  tools?: string[]
}

export function ChatConfig(_props: SlotProps) {
  const [provider, setProvider] = useState<'deepseek' | 'openai'>('deepseek')
  const [model, setModel] = useState('deepseek-chat')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [agentMode, setAgentMode] = useState<AgentMode>('standard')
  const [apiKey, setApiKey] = useState('')
  const [hint, setHint] = useState('')
  const [configured, setConfigured] = useState(false)
  const [tools, setTools] = useState<string[]>([])
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  async function load() {
    const res = await fetch('/api/chat/config')
    const data = (await res.json()) as ChatPublicConfig
    setProvider(data.provider)
    setModel(data.model)
    setSystemPrompt(data.systemPrompt)
    setAgentMode(data.agentMode === 'minimal' ? 'minimal' : 'standard')
    setHint(data.hint)
    setConfigured(data.configured)
    setTools(Array.isArray(data.tools) ? data.tools : [])
  }

  useEffect(() => {
    void load()
  }, [])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setStatus('')
    if (!configured && !apiKey.trim()) {
      setError('请先填写 API Key，否则会走本地回声，不会调用模型。')
      return
    }
    const res = await fetch('/api/chat/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider,
        model,
        systemPrompt,
        agentMode,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      }),
    })
    if (!res.ok) {
      setError(`保存失败：HTTP ${res.status}`)
      return
    }
    const data = (await res.json()) as ChatPublicConfig
    setHint(data.hint)
    setConfigured(data.configured)
    setAgentMode(data.agentMode === 'minimal' ? 'minimal' : 'standard')
    setTools(Array.isArray(data.tools) ? data.tools : [])
    setApiKey('')
    setStatus(
      data.configured
        ? `已保存到 host（.cordis/chat-config.json），重启后仍生效。当前 ${data.hint}`
        : '已保存，但尚未配置 API Key',
    )
  }

  const field =
    'mt-1 w-full rounded-[12px] border border-[var(--dsw-border)] bg-[var(--dsw-surface)] px-2 py-2 text-sm text-[var(--dsw-label)] outline-none'

  return (
    <form
      className="space-y-3 rounded-[12px] border border-[var(--dsw-border)] bg-[var(--dsw-surface)] px-3 py-3"
      data-testid="assistant-config"
      onSubmit={onSubmit}
    >
      <h3 className="m-0 text-sm font-medium">Assistant</h3>
      <p className="m-0 text-xs leading-5 text-[var(--dsw-label-3)]">
        Key 保存在 Node host 的 <code>.cordis/chat-config.json</code>（已 gitignore）。留空表示保留当前 Key。
        {configured ? ` 当前 ${hint}` : ' 尚未配置 Key —— 发消息只会本地回声。'}
      </p>
      <label className="block text-xs text-[var(--dsw-label-3)]">
        Provider
        <select
          className={field}
          value={provider}
          onChange={(event) => {
            const next = event.target.value as 'deepseek' | 'openai'
            setProvider(next)
            setModel(next === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini')
          }}
        >
          <option value="deepseek">DeepSeek</option>
          <option value="openai">OpenAI</option>
        </select>
      </label>
      <label className="block text-xs text-[var(--dsw-label-3)]">
        Model
        <input className={field} value={model} onChange={(event) => setModel(event.target.value)} />
      </label>
      <label className="block text-xs text-[var(--dsw-label-3)]">
        Agent mode
        <select
          className={field}
          value={agentMode}
          onChange={(event) => setAgentMode(event.target.value as AgentMode)}
          data-testid="agent-mode"
        >
          <option value="standard">标准模式 — 全部已注册工具</option>
          <option value="minimal">极简模式 — 对齐 dsh：仅 bash + str_replace_editor</option>
        </select>
      </label>
      <p className="m-0 text-xs leading-5 text-[var(--dsw-label-3)]">
        也可在对话输入上方与文件并列的胶囊快速切换「标准 / 极简」。
      </p>
      {tools.length ? (
        <p className="m-0 text-xs leading-5 text-[var(--dsw-label-3)]">
          当前对模型可见工具：{tools.join(', ')}
        </p>
      ) : null}
      <label className="block text-xs text-[var(--dsw-label-3)]">
        API Key
        <input
          className={field}
          type="password"
          autoComplete="off"
          placeholder={configured ? 'Configured — type to overwrite' : 'sk-…'}
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
        />
      </label>
      <label className="block text-xs text-[var(--dsw-label-3)]">
        System prompt
        <textarea className={`${field} min-h-20`} value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} />
      </label>
      <button
        className="rounded-[12px] px-3 py-2 text-sm text-[var(--dsw-bg)]"
        style={{ background: 'var(--dsw-business)' }}
        type="submit"
      >
        Save Assistant
      </button>
      {status ? <p className="m-0 text-xs text-[var(--dsw-ok)]">{status}</p> : null}
      {error ? <p className="m-0 text-xs text-[var(--dsw-danger,#b42318)]">{error}</p> : null}
    </form>
  )
}
