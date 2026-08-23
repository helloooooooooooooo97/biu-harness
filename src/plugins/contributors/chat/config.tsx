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

  const inputCls = [
    'w-full rounded-[8px] px-2.5 py-[7px] text-[13px] text-[var(--dsw-label)]',
    'border border-[var(--dsw-border)] bg-[var(--dsw-input)] outline-none',
    'transition-colors',
  ].join(' ')
  const labelCls = 'text-[11px] font-semibold text-[var(--dsw-label-3)]'
  const groupCls = 'rounded-[10px] border border-[color-mix(in_srgb,var(--dsw-border)_75%,transparent)] p-3'

  return (
    <form
      className="flex flex-col gap-4 rounded-[12px] border border-[color-mix(in_srgb,var(--dsw-border)_75%,transparent)] bg-[color-mix(in_srgb,var(--dsw-surface)_92%,transparent)] px-3 py-4"
      data-testid="assistant-config"
      onSubmit={onSubmit}
    >
      <header>
        <h3 className="m-0 text-[13px] font-semibold text-[var(--dsw-label)]">Assistant</h3>
        <p className="m-0 mt-1 text-[11px] leading-[1.5] text-[var(--dsw-label-3)]">
          Key 保存在 Node host 的 <code>.cordis/chat-config.json</code>（已 gitignore），留空表示保留当前 Key。
          {configured ? ` 当前 ${hint}` : ' 尚未配置 Key —— 发消息只会本地回声。'}
        </p>
      </header>

      <section className={groupCls}>
        <header className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--dsw-label-3)]">连接</header>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className={labelCls}>Provider</span>
            <select
              className={inputCls}
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
          <label className="flex flex-col gap-1">
            <span className={labelCls}>Model</span>
            <input className={inputCls} value={model} onChange={(event) => setModel(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelCls}>Agent mode</span>
            <select
              className={inputCls}
              value={agentMode}
              onChange={(event) => setAgentMode(event.target.value as AgentMode)}
              data-testid="agent-mode"
            >
              <option value="standard">标准模式 — 全部已注册工具</option>
              <option value="minimal">极简模式 — 对齐 dsh：仅 bash + str_replace_editor</option>
            </select>
          </label>
        </div>
      </section>

      {tools.length ? (
        <div className="rounded-[8px] bg-[color-mix(in_srgb,var(--dsw-muted-fill)_40%,transparent)] px-2.5 py-2 text-[11px] leading-[1.5] text-[var(--dsw-label-2)]">
          当前对模型可见工具：{tools.join(', ')}
        </div>
      ) : null}

      <section className={groupCls}>
        <header className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--dsw-label-3)]">凭据与提示</header>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className={labelCls}>API Key</span>
            <input
              className={inputCls}
              type="password"
              autoComplete="off"
              placeholder={configured ? 'Configured — type to overwrite' : 'sk-…'}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelCls}>System prompt</span>
            <textarea
              className={`${inputCls} min-h-[84px] resize-y leading-[1.5]`}
              value={systemPrompt}
              onChange={(event) => setSystemPrompt(event.target.value)}
            />
          </label>
        </div>
      </section>

      <div className="flex items-center gap-2">
        <button
          className="rounded-[8px] px-3 py-[7px] text-[13px] font-medium text-[var(--dsw-bg)] transition-opacity hover:opacity-90"
          style={{ background: 'var(--dsw-business)' }}
          type="submit"
        >
          保存配置
        </button>
        <span className="text-[11px] text-[var(--dsw-label-3)]">配置刷新后立即生效</span>
      </div>
      {status ? <p className="m-0 text-[11px] text-[var(--dsw-ok)]">{status}</p> : null}
      {error ? <p className="m-0 text-[11px] text-[var(--dsw-danger,#b42318)]">{error}</p> : null}
    </form>
  )
}
