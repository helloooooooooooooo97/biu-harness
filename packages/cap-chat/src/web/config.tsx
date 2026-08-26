import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { SlotProps } from '@biu/web-slots'

type ChatProvider = 'deepseek' | 'openai' | 'anthropic'
type EndpointGroup = 'official' | 'relay' | 'local' | 'custom'

interface ModelDef {
  id: string
  label: string
  provider: ChatProvider
  endpointId: string
  model: string
  category: string
  note?: string
  builtin?: boolean
  endpointConfigured?: boolean
}

interface EndpointView {
  id: string
  label: string
  group: EndpointGroup
  protocol: string
  provider: ChatProvider
  baseUrl: string
  defaultBaseUrl: string
  configured: boolean
  hint: string
  placeholder: string
  note?: string
  builtin: boolean
}

interface ProviderView {
  label: string
  configured: boolean
  hint: string
  baseUrl?: string
  group?: string
}

interface ChatPublicConfig {
  endpointId?: string
  provider: ChatProvider
  model: string
  configured: boolean
  hint: string
  baseUrl?: string
  providers?: Record<string, ProviderView>
  endpoints?: EndpointView[]
  modelCatalog?: ModelDef[]
}

const GROUP_ORDER: EndpointGroup[] = ['official', 'relay', 'local', 'custom']
const GROUP_LABEL: Record<EndpointGroup, string> = {
  official: '官方',
  relay: '中转站',
  local: '本地',
  custom: '自定义',
}

export function ChatConfig(_props: SlotProps) {
  const [endpointId, setEndpointId] = useState('deepseek')
  const [model, setModel] = useState('deepseek-chat')
  const [endpoints, setEndpoints] = useState<EndpointView[]>([])
  const [modelCatalog, setModelCatalog] = useState<ModelDef[]>([])
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  const [baseUrlDraft, setBaseUrlDraft] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  // 追加模型
  const [newModelName, setNewModelName] = useState('')
  const [newModelLabel, setNewModelLabel] = useState('')

  // 追加自定义入口
  const [showAddEndpoint, setShowAddEndpoint] = useState(false)
  const [newEpLabel, setNewEpLabel] = useState('')
  const [newEpUrl, setNewEpUrl] = useState('')
  const [newEpProtocol, setNewEpProtocol] = useState<'openai-compat' | 'anthropic'>('openai-compat')

  async function load() {
    const res = await fetch('/api/chat/config')
    const data = (await res.json()) as ChatPublicConfig
    const eps = Array.isArray(data.endpoints) ? data.endpoints : []
    setEndpoints(eps)
    const cats = Array.isArray(data.modelCatalog) ? data.modelCatalog : []
    setModelCatalog(cats)
    const eid = data.endpointId || data.provider || 'deepseek'
    setEndpointId(eid)
    setModel(data.model)
    const ep = eps.find((e) => e.id === eid)
    setBaseUrlDraft(ep?.baseUrl || data.baseUrl || '')
    setApiKeyDraft('')
  }

  useEffect(() => {
    void load()
  }, [])

  const current = endpoints.find((e) => e.id === endpointId)
  const availableModels = useMemo(
    () => modelCatalog.filter((m) => m.endpointId === endpointId),
    [modelCatalog, endpointId],
  )
  const currentModelInCatalog = availableModels.find((m) => m.model === model) ?? modelCatalog.find((m) => m.model === model)
  const configured = current?.configured ?? false

  const endpointsByGroup = useMemo(() => {
    const map = new Map<EndpointGroup, EndpointView[]>()
    for (const g of GROUP_ORDER) map.set(g, [])
    for (const ep of endpoints) {
      const g = (GROUP_ORDER.includes(ep.group) ? ep.group : 'custom') as EndpointGroup
      map.get(g)!.push(ep)
    }
    return map
  }, [endpoints])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setStatus('')
    if (!configured && !apiKeyDraft.trim() && current?.group !== 'local') {
      setError('请填写 API Key，或选择本地入口（Ollama / LM Studio 等）。')
      return
    }
    const body: Record<string, unknown> = {
      endpointId,
      model,
    }
    if (apiKeyDraft.trim()) {
      body.setApiKey = { [endpointId]: apiKeyDraft.trim() }
    }
    if (baseUrlDraft.trim() && baseUrlDraft.trim() !== (current?.defaultBaseUrl ?? '')) {
      body.setBaseUrl = { [endpointId]: baseUrlDraft.trim() }
    } else if (baseUrlDraft.trim() === (current?.defaultBaseUrl ?? '') && current?.baseUrl !== current?.defaultBaseUrl) {
      // 用户把 URL 改回默认 → 清除覆盖
      body.setBaseUrl = { [endpointId]: null }
    }
    const res = await fetch('/api/chat/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      setError(`保存失败：HTTP ${res.status}`)
      return
    }
    const data = (await res.json()) as ChatPublicConfig
    applyPublic(data)
    setApiKeyDraft('')
    setStatus('已保存。配置立即生效，重启后仍生效（.cordis/chat-config.json）。')
  }

  function applyPublic(data: ChatPublicConfig) {
    const eps = Array.isArray(data.endpoints) ? data.endpoints : []
    setEndpoints(eps)
    setModelCatalog(Array.isArray(data.modelCatalog) ? data.modelCatalog : [])
    const eid = data.endpointId || data.provider || endpointId
    setEndpointId(eid)
    setModel(data.model)
    const ep = eps.find((e) => e.id === eid)
    setBaseUrlDraft(ep?.baseUrl || data.baseUrl || '')
  }

  async function onAddModel() {
    setError('')
    setStatus('')
    const modelName = newModelName.trim()
    if (!modelName) {
      setError('请填写模型名称（上游 API 的 model id）。')
      return
    }
    const res = await fetch('/api/chat/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        addModel: {
          endpointId,
          model: modelName,
          label: newModelLabel.trim() || modelName,
        },
      }),
    })
    if (!res.ok) {
      setError(`添加模型失败：HTTP ${res.status}`)
      return
    }
    applyPublic((await res.json()) as ChatPublicConfig)
    setNewModelName('')
    setNewModelLabel('')
    setStatus(`已在「${current?.label ?? endpointId}」下添加模型 ${modelName}`)
  }

  async function onRemoveModel(id: string) {
    setError('')
    const res = await fetch('/api/chat/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ removeCustomModel: id }),
    })
    if (!res.ok) {
      setError(`删除失败：HTTP ${res.status}`)
      return
    }
    applyPublic((await res.json()) as ChatPublicConfig)
    setStatus('已删除自定义模型')
  }

  async function onAddEndpoint() {
    setError('')
    setStatus('')
    if (!newEpLabel.trim() || !newEpUrl.trim()) {
      setError('请填写入口名称和模型 URL（baseUrl）。')
      return
    }
    const res = await fetch('/api/chat/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        addEndpoint: {
          label: newEpLabel.trim(),
          baseUrl: newEpUrl.trim(),
          protocol: newEpProtocol,
        },
      }),
    })
    if (!res.ok) {
      setError(`添加入口失败：HTTP ${res.status}`)
      return
    }
    applyPublic((await res.json()) as ChatPublicConfig)
    setShowAddEndpoint(false)
    setNewEpLabel('')
    setNewEpUrl('')
    setNewEpProtocol('openai-compat')
    setStatus('已添加自定义入口，请填写 Key 并添加模型名。')
  }

  async function onRemoveEndpoint(id: string) {
    setError('')
    const res = await fetch('/api/chat/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ removeCustomEndpoint: id }),
    })
    if (!res.ok) {
      setError(`删除失败：HTTP ${res.status}`)
      return
    }
    applyPublic((await res.json()) as ChatPublicConfig)
    setStatus('已删除自定义入口')
  }

  const inputCls = [
    'w-full rounded-[8px] px-2.5 py-[7px] text-[13px] text-[var(--dsw-label)]',
    'border border-[var(--dsw-border)] bg-[var(--dsw-input)] outline-none',
    'transition-colors',
  ].join(' ')
  const labelCls = 'text-[11px] font-semibold text-[var(--dsw-label-3)]'
  const btnSecondary = [
    'rounded-[8px] px-2.5 py-[6px] text-[12px] font-medium',
    'border border-[var(--dsw-border)] text-[var(--dsw-label)]',
    'hover:bg-[color-mix(in_srgb,var(--dsw-muted-fill)_50%,transparent)]',
  ].join(' ')

  return (
    <form
      className="relative flex h-full min-h-[420px] flex-col gap-4 px-1 pb-14"
      data-testid="assistant-config"
      onSubmit={onSubmit}
    >
      <p className="text-[11px] leading-relaxed text-[var(--dsw-label-2)]">
        统一入口多模型：选一个官方 / 中转站 / 本地入口，共用一把 Key 与一个 URL，下面可挂多个模型名。也可添加自定义中转 URL。
      </p>

      {/* 入口选择 */}
      <section className="flex flex-col gap-2.5">
        <span className={labelCls}>模型入口</span>
        <select
          className={inputCls}
          value={endpointId}
          data-testid="endpoint"
          onChange={(event) => {
            const next = event.target.value
            setEndpointId(next)
            const ep = endpoints.find((e) => e.id === next)
            setBaseUrlDraft(ep?.baseUrl ?? '')
            setApiKeyDraft('')
            const def = modelCatalog.find((m) => m.endpointId === next)
            if (def) setModel(def.model)
          }}
        >
          {GROUP_ORDER.map((g) => {
            const list = endpointsByGroup.get(g) ?? []
            if (!list.length) return null
            return (
              <optgroup key={g} label={GROUP_LABEL[g]}>
                {list.map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    {ep.label}
                    {ep.configured ? '（已配置）' : '（未配置）'}
                    {ep.note ? ` · ${ep.note}` : ''}
                  </option>
                ))}
              </optgroup>
            )
          })}
        </select>

        <label className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--dsw-label)]">
            <span
              className={`inline-block size-1.5 rounded-full ${
                configured ? 'bg-[var(--dsw-ok)]' : 'bg-[var(--dsw-label-3)] opacity-40'
              }`}
            />
            API Key
            {current?.hint ? (
              <span className="font-normal text-[var(--dsw-label-3)]">· {current.hint}</span>
            ) : null}
          </span>
          <input
            className={inputCls}
            type="password"
            autoComplete="off"
            placeholder={
              configured
                ? `已配置 · 输入可覆盖 (${current?.placeholder ?? 'sk-…'})`
                : current?.placeholder ?? 'sk-…'
            }
            value={apiKeyDraft}
            onChange={(e) => setApiKeyDraft(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-[var(--dsw-label)]">模型 URL（baseUrl）</span>
          <input
            className={inputCls}
            type="url"
            autoComplete="off"
            data-testid="base-url"
            placeholder="https://api.example.com/v1"
            value={baseUrlDraft}
            onChange={(e) => setBaseUrlDraft(e.target.value)}
          />
          <span className="text-[10px] text-[var(--dsw-label-3)]">
            不含 /chat/completions；中转站填站方文档中的根地址。默认：{current?.defaultBaseUrl || '—'}
          </span>
        </label>

        {current && !current.builtin ? (
          <button type="button" className={btnSecondary} onClick={() => void onRemoveEndpoint(current.id)}>
            删除此自定义入口
          </button>
        ) : null}
      </section>

      {/* 模型选择 + 追加 */}
      <section className="flex flex-col gap-2.5">
        <span className={labelCls}>模型名称</span>
        {availableModels.length > 0 ? (
          <select
            className={inputCls}
            value={currentModelInCatalog?.id ?? model}
            data-testid="model"
            onChange={(event) => {
              const def = modelCatalog.find((m) => m.id === event.target.value)
              if (def) setModel(def.model)
              else setModel(event.target.value)
            }}
          >
            {availableModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} ({m.model})
                {m.note ? ` — ${m.note}` : ''}
              </option>
            ))}
          </select>
        ) : (
          <div className="rounded-[8px] bg-[color-mix(in_srgb,var(--dsw-muted-fill)_40%,transparent)] px-2.5 py-2 text-[11px] text-[var(--dsw-label-2)]">
            当前入口尚无模型，请在下方添加模型名称。
          </div>
        )}

        <div className="flex flex-col gap-1.5 rounded-[8px] border border-dashed border-[var(--dsw-border)] p-2.5">
          <span className="text-[11px] font-medium text-[var(--dsw-label)]">在此入口追加模型</span>
          <div className="flex gap-2">
            <input
              className={inputCls}
              placeholder="模型名称 model id，如 gpt-4o"
              value={newModelName}
              onChange={(e) => setNewModelName(e.target.value)}
            />
            <input
              className={`${inputCls} max-w-[140px]`}
              placeholder="展示名（可选）"
              value={newModelLabel}
              onChange={(e) => setNewModelLabel(e.target.value)}
            />
            <button type="button" className={btnSecondary} onClick={() => void onAddModel()}>
              添加
            </button>
          </div>
          {availableModels.some((m) => m.builtin === false) ? (
            <ul className="mt-1 flex flex-col gap-1">
              {availableModels
                .filter((m) => m.builtin === false)
                .map((m) => (
                  <li key={m.id} className="flex items-center justify-between text-[11px] text-[var(--dsw-label-2)]">
                    <span>
                      {m.label} <code className="text-[10px]">{m.model}</code>
                    </span>
                    <button type="button" className="text-[var(--dsw-danger,#b42318)]" onClick={() => void onRemoveModel(m.id)}>
                      删除
                    </button>
                  </li>
                ))}
            </ul>
          ) : null}
        </div>

        {!configured && current?.group !== 'local' ? (
          <div className="rounded-[8px] bg-[color-mix(in_srgb,var(--dsw-muted-fill)_40%,transparent)] px-2.5 py-2 text-[11px] text-[var(--dsw-label-2)]">
            当前入口未配置 Key：发消息会本地回声，不会调用模型。
          </div>
        ) : null}
      </section>

      {/* 自定义入口 */}
      <section className="flex flex-col gap-2">
        {!showAddEndpoint ? (
          <button type="button" className={btnSecondary} onClick={() => setShowAddEndpoint(true)}>
            + 添加自定义中转 / URL
          </button>
        ) : (
          <div className="flex flex-col gap-2 rounded-[8px] border border-[var(--dsw-border)] p-2.5">
            <span className={labelCls}>自定义入口</span>
            <input
              className={inputCls}
              placeholder="名称，如 我的 OneAPI"
              value={newEpLabel}
              onChange={(e) => setNewEpLabel(e.target.value)}
            />
            <input
              className={inputCls}
              placeholder="模型 URL，如 https://gate.example.com/v1"
              value={newEpUrl}
              onChange={(e) => setNewEpUrl(e.target.value)}
            />
            <select
              className={inputCls}
              value={newEpProtocol}
              onChange={(e) => setNewEpProtocol(e.target.value as 'openai-compat' | 'anthropic')}
            >
              <option value="openai-compat">OpenAI 兼容（chat/completions）</option>
              <option value="anthropic">Anthropic Messages</option>
            </select>
            <div className="flex gap-2">
              <button type="button" className={btnSecondary} onClick={() => void onAddEndpoint()}>
                确认添加
              </button>
              <button type="button" className={btnSecondary} onClick={() => setShowAddEndpoint(false)}>
                取消
              </button>
            </div>
          </div>
        )}
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
