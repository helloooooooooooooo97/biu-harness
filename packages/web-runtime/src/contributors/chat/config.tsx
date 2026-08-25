import { useEffect, useState, type FormEvent } from 'react'
import type { SlotProps } from '../../registry/slots.ts'

type ChatProvider = 'deepseek' | 'openai' | 'anthropic'

interface ModelDef {
  id: string
  label: string
  provider: ChatProvider
  model: string
  category: string
  note?: string
}

interface ProviderView {
  label: string
  configured: boolean
  hint: string
}

interface ChatPublicConfig {
  provider: ChatProvider
  model: string
  configured: boolean
  hint: string
  providers?: Record<ChatProvider, ProviderView>
  modelCatalog?: ModelDef[]
}

const PROVIDERS: { key: ChatProvider; label: string; placeholder: string }[] = [
  { key: 'deepseek', label: 'DeepSeek（Flash / Pro）', placeholder: 'sk-…' },
  { key: 'anthropic', label: 'Claude', placeholder: 'sk-ant-…' },
  { key: 'openai', label: 'GPT', placeholder: 'sk-…' },
]

const PROVIDER_ORDER: ChatProvider[] = ['deepseek', 'anthropic', 'openai']

export function ChatConfig(_props: SlotProps) {
  const [provider, setProvider] = useState<ChatProvider>('deepseek')
  const [model, setModel] = useState('deepseek-chat')
  const [apiKeys, setApiKeys] = useState<Record<ChatProvider, string>>({
    deepseek: '',
    openai: '',
    anthropic: '',
  })
  const [providers, setProviders] = useState<Record<ChatProvider, ProviderView> | null>(null)
  const [modelCatalog, setModelCatalog] = useState<ModelDef[]>([])
  const [hint, setHint] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  async function load() {
    const res = await fetch('/api/chat/config')
    const data = (await res.json()) as ChatPublicConfig
    setProvider(data.provider)
    setModel(data.model)
    setHint(data.hint ?? '')
    const cats = Array.isArray(data.modelCatalog) ? data.modelCatalog : []
    setModelCatalog(cats)
    if (data.providers) setProviders(data.providers)
  }

  useEffect(() => {
    void load()
  }, [])

  const availableModels = modelCatalog.filter((m) => m.provider === provider && providers?.[m.provider]?.configured)
  const currentModelInCatalog = modelCatalog.find((m) => m.model === model)
  const currentProviderConfigured = providers?.[provider]?.configured ?? false

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setStatus('')
    const filled = PROVIDERS.some((p) => apiKeys[p.key].trim())
    const hasAnyConfigured = providers
      ? PROVIDER_ORDER.some((p) => providers[p]?.configured || apiKeys[p].trim())
      : false
    if (!filled && !hasAnyConfigured) {
      setError('请至少为一个模型提供商填写 API Key，否则发消息只会本地回声，不会调用模型。')
      return
    }
    const nullIfEmpty = (v: string) => (v.trim() ? v.trim() : undefined)
    const res = await fetch('/api/chat/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider,
        model,
        setApiKey: {
          deepseek: nullIfEmpty(apiKeys.deepseek),
          openai: nullIfEmpty(apiKeys.openai),
          anthropic: nullIfEmpty(apiKeys.anthropic),
        },
      }),
    })
    if (!res.ok) {
      setError(`保存失败：HTTP ${res.status}`)
      return
    }
    const data = (await res.json()) as ChatPublicConfig
    setHint(data.hint ?? '')
    if (data.providers) setProviders(data.providers)
    setApiKeys({ deepseek: '', openai: '', anthropic: '' })
    setStatus('已保存。配置刷新后立即生效，重启后仍生效（.cordis/chat-config.json）。')
  }

  const inputCls = [
    'w-full rounded-[8px] px-2.5 py-[7px] text-[13px] text-[var(--dsw-label)]',
    'border border-[var(--dsw-border)] bg-[var(--dsw-input)] outline-none',
    'transition-colors',
  ].join(' ')
  const labelCls = 'text-[11px] font-semibold text-[var(--dsw-label-3)]'

  return (
    <form
      className="relative flex h-full min-h-[420px] flex-col gap-4 px-1 pb-14"
      data-testid="assistant-config"
      onSubmit={onSubmit}
    >
      {/* API Key：每个 provider 独立 */}
      <section className="flex flex-col gap-2.5">
        <span className={labelCls}>API Key</span>
        {PROVIDERS.map((p) => {
          const view = providers?.[p.key]
          return (
            <label key={p.key} className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--dsw-label)]">
                <span
                  className={`inline-block size-1.5 rounded-full ${
                    view?.configured ? 'bg-[var(--dsw-ok)]' : 'bg-[var(--dsw-label-3)] opacity-40'
                  }`}
                />
                {p.label}
              </span>
              <input
                className={inputCls}
                type="password"
                autoComplete="off"
                placeholder={view?.configured ? `已配置 · 输入可覆盖 (${view.hint})` : p.placeholder}
                value={apiKeys[p.key]}
                onChange={(e) => setApiKeys((prev) => ({ ...prev, [p.key]: e.target.value }))}
              />
            </label>
          )
        })}
      </section>

      {/* 模型选择：只列已验证 provider 的模型 */}
      <section className="flex flex-col gap-2.5">
        <span className={labelCls}>Model</span>
        <div className="flex gap-3">
          <label className="flex w-1/3 flex-col gap-1">
            <select
              className={inputCls}
              value={provider}
              data-testid="provider"
              onChange={(event) => {
                const next = event.target.value as ChatProvider
                setProvider(next)
                const def = modelCatalog.find((m) => m.provider === next)
                if (def) setModel(def.model)
              }}
            >
              {PROVIDER_ORDER.map((key) => (
                <option key={key} value={key}>
                  {providers?.[key]?.label ?? key} {providers?.[key]?.configured ? '（已配置）' : '（未配置）'}
                </option>
              ))}
            </select>
          </label>
          <label className="flex w-2/3 flex-col gap-1">
            {availableModels.length > 0 ? (
              <select
                className={inputCls}
                value={currentModelInCatalog?.id ?? model}
                data-testid="model"
                onChange={(event) => {
                  const def = modelCatalog.find((m) => m.id === event.target.value)
                  if (def) setModel(def.model)
                }}
              >
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                    {m.note ? ` — ${m.note}` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="rounded-[8px] bg-[color-mix(in_srgb,var(--dsw-muted-fill)_40%,transparent)] px-2.5 py-2 text-[11px] text-[var(--dsw-label-2)]">
                当前提供商尚未配置 API Key，配置后即可选择其模型。
              </div>
            )}
          </label>
        </div>
        {!currentProviderConfigured ? (
          <div className="rounded-[8px] bg-[color-mix(in_srgb,var(--dsw-muted-fill)_40%,transparent)] px-2.5 py-2 text-[11px] text-[var(--dsw-label-2)]">
            当前选中的提供商未配置 Key：发消息会本地回声，不会调用模型。
          </div>
        ) : null}
      </section>

      <div className="flex flex-1 items-end justify-end gap-2">
        {status ? <span className="text-[11px] text-[var(--dsw-ok)]">{status}</span> : null}
        {error ? <span className="text-[11px] text-[var(--dsw-danger,#b42318)]">{error}</span> : null}
        <button
          className="rounded-[8px] px-3 py-[7px] text-[13px] font-medium text-[var(--dsw-bg)] transition-opacity hover:opacity-90"
          style={{ background: 'var(--dsw-business)' }}
          type="submit"
        >
          保存
        </button>
      </div>
    </form>
  )
}
