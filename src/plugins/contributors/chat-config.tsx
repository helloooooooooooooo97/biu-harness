import { useEffect, useState, type FormEvent } from 'react'
import type { Context } from 'cordis'
import type { SlotProps } from '../registry/slots.ts'

export const name = 'chat-config-ui'
export const inject = ['slots']

interface ChatPublicConfig {
  provider: 'deepseek' | 'openai'
  model: string
  systemPrompt: string
  configured: boolean
  hint: string
}

function ChatConfig(_props: SlotProps) {
  const [provider, setProvider] = useState<'deepseek' | 'openai'>('deepseek')
  const [model, setModel] = useState('deepseek-chat')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [hint, setHint] = useState('')
  const [configured, setConfigured] = useState(false)
  const [status, setStatus] = useState('')

  async function load() {
    const res = await fetch('/api/chat/config')
    const data = (await res.json()) as ChatPublicConfig
    setProvider(data.provider)
    setModel(data.model)
    setSystemPrompt(data.systemPrompt)
    setHint(data.hint)
    setConfigured(data.configured)
  }

  useEffect(() => {
    void load()
  }, [])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const res = await fetch('/api/chat/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider,
        model,
        systemPrompt,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      }),
    })
    const data = (await res.json()) as ChatPublicConfig
    setHint(data.hint)
    setConfigured(data.configured)
    setApiKey('')
    setStatus('已保存到 host（不回传完整 Key）')
  }

  return (
    <form className="space-y-3 rounded-xl border border-[#3c4043] bg-[#2d2e30] px-3 py-3" onSubmit={onSubmit}>
      <h3 className="m-0 text-sm font-medium">助手</h3>
      <p className="m-0 text-xs leading-5 text-[#9aa0a6]">
        Key 只存在 Node 进程里。留空 Key 表示沿用已有配置。
        {configured ? ` 当前 ${hint}` : ' 尚未配置 Key。'}
      </p>
      <label className="block text-xs text-[#9aa0a6]">
        服务
        <select
          className="mt-1 w-full rounded-lg border border-[#3c4043] bg-[#1b1c1d] px-2 py-2 text-sm text-[#e8eaed]"
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
      <label className="block text-xs text-[#9aa0a6]">
        模型
        <input
          className="mt-1 w-full rounded-lg border border-[#3c4043] bg-[#1b1c1d] px-2 py-2 text-sm text-[#e8eaed] outline-none"
          value={model}
          onChange={(event) => setModel(event.target.value)}
        />
      </label>
      <label className="block text-xs text-[#9aa0a6]">
        API Key
        <input
          className="mt-1 w-full rounded-lg border border-[#3c4043] bg-[#1b1c1d] px-2 py-2 text-sm text-[#e8eaed] outline-none"
          type="password"
          autoComplete="off"
          placeholder={configured ? '已配置，输入则覆盖' : 'sk-…'}
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
        />
      </label>
      <label className="block text-xs text-[#9aa0a6]">
        人设
        <textarea
          className="mt-1 min-h-20 w-full rounded-lg border border-[#3c4043] bg-[#1b1c1d] px-2 py-2 text-sm text-[#e8eaed] outline-none"
          value={systemPrompt}
          onChange={(event) => setSystemPrompt(event.target.value)}
        />
      </label>
      <button className="rounded-lg bg-[#4d6bfe] px-3 py-2 text-sm text-white" type="submit">
        保存
      </button>
      {status ? <p className="m-0 text-xs text-[#86efac]">{status}</p> : null}
    </form>
  )
}

export function apply(ctx: Context) {
  ctx.slots.inject('settings', () => ctx.slots.fill('settings', ChatConfig, { key: 'chat-config', order: 10 }))
}
