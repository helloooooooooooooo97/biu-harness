import { useEffect, useState, type FormEvent } from 'react'
import type { SlotProps } from '../../registry/slots.ts'

interface ChatPublicConfig {
  provider: 'deepseek' | 'openai'
  model: string
  systemPrompt: string
  configured: boolean
  hint: string
}

export function ChatConfig(_props: SlotProps) {
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
    setStatus('Saved on host (full key never returned)')
  }

  const field =
    'mt-1 w-full rounded-[12px] border border-[var(--dsw-border)] bg-white px-2 py-2 text-sm text-[var(--dsw-label)] outline-none'

  return (
    <form className="space-y-3 rounded-[12px] border border-[var(--dsw-border)] bg-white px-3 py-3" onSubmit={onSubmit}>
      <h3 className="m-0 text-sm font-medium">Assistant</h3>
      <p className="m-0 text-xs leading-5 text-[var(--dsw-label-3)]">
        Keys live in the Node host. Leave blank to keep the current key.
        {configured ? ` Current ${hint}` : ' No key yet.'}
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
      <button className="rounded-[12px] px-3 py-2 text-sm text-white" style={{ background: 'var(--dsw-business)' }} type="submit">
        Save
      </button>
      {status ? <p className="m-0 text-xs text-[var(--dsw-ok)]">{status}</p> : null}
    </form>
  )
}
