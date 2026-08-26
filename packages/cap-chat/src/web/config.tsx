/**
 * Models 设置：
 * 1) 官方 Token：DeepSeek / Claude / GPT 独立 Key（始终可见）
 * 2) 默认模型：提供商 + 模型下拉（有目录就能看见模型）
 * 3) 第三方：自定义 Base URL + Token + 模型名（中转站 / OneAPI 等）
 */
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { LuPlus, LuTrash2 } from 'react-icons/lu'
import type { SlotProps } from '@biu/web-slots'

type ChatProvider = 'deepseek' | 'openai' | 'anthropic'

interface ModelDef {
  id: string
  label: string
  provider: ChatProvider
  endpointId: string
  model: string
  note?: string
  builtin?: boolean
}

interface EndpointView {
  id: string
  label: string
  group: string
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

const OFFICIAL: { key: ChatProvider; label: string; placeholder: string }[] = [
  { key: 'deepseek', label: 'DeepSeek', placeholder: 'sk-…' },
  { key: 'anthropic', label: 'Claude（Anthropic）', placeholder: 'sk-ant-…' },
  { key: 'openai', label: 'GPT（OpenAI）', placeholder: 'sk-…' },
]

const OFFICIAL_ORDER: ChatProvider[] = ['deepseek', 'anthropic', 'openai']

const inputCls = [
  'w-full rounded-[8px] px-2.5 py-[7px] text-[13px] text-[var(--dsw-label)]',
  'border border-[var(--dsw-border)] bg-[var(--dsw-input)] outline-none',
  'placeholder:text-[var(--dsw-label-3)] focus:border-[var(--dsw-business)]',
].join(' ')
const labelCls = 'text-[11px] font-semibold text-[var(--dsw-label-3)]'
const ghostBtn = [
  'inline-flex items-center gap-1 rounded-[8px] px-2.5 py-[6px] text-[12px] font-medium',
  'border border-[var(--dsw-border)] text-[var(--dsw-label)]',
  'hover:bg-[var(--dsw-hover)]',
].join(' ')

export function ChatConfig(_props: SlotProps) {
  const [endpointId, setEndpointId] = useState('deepseek')
  const [model, setModel] = useState('deepseek-chat')
  const [endpoints, setEndpoints] = useState<EndpointView[]>([])
  const [modelCatalog, setModelCatalog] = useState<ModelDef[]>([])
  const [providers, setProviders] = useState<Record<string, ProviderView> | null>(null)
  const [officialKeys, setOfficialKeys] = useState<Record<ChatProvider, string>>({
    deepseek: '',
    openai: '',
    anthropic: '',
  })
  const [thirdKeyDraft, setThirdKeyDraft] = useState('')
  const [thirdUrlDraft, setThirdUrlDraft] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const [newModelName, setNewModelName] = useState('')
  const [showAddThird, setShowAddThird] = useState(false)
  const [newEpLabel, setNewEpLabel] = useState('')
  const [newEpUrl, setNewEpUrl] = useState('')
  const [newEpKey, setNewEpKey] = useState('')
  const [newEpProtocol, setNewEpProtocol] = useState<'openai-compat' | 'anthropic'>('openai-compat')
  const [presetId, setPresetId] = useState('')

  const officialEndpoints = useMemo(
    () => endpoints.filter((e) => OFFICIAL_ORDER.includes(e.id as ChatProvider)),
    [endpoints],
  )
  const thirdEndpoints = useMemo(
    () => endpoints.filter((e) => !OFFICIAL_ORDER.includes(e.id as ChatProvider)),
    [endpoints],
  )
  const relayPresets = useMemo(
    () => thirdEndpoints.filter((e) => e.group === 'relay' || e.group === 'local' || (e.group === 'official' && !OFFICIAL_ORDER.includes(e.id as ChatProvider))),
    [thirdEndpoints],
  )

  const isOfficial = OFFICIAL_ORDER.includes(endpointId as ChatProvider)
  const current = endpoints.find((e) => e.id === endpointId)
  const availableModels = useMemo(
    () => modelCatalog.filter((m) => m.endpointId === endpointId),
    [modelCatalog, endpointId],
  )
  const currentModelInCatalog =
    availableModels.find((m) => m.model === model) ?? availableModels[0]

  function applyPublic(data: ChatPublicConfig, preferId?: string) {
    const eps = Array.isArray(data.endpoints) ? data.endpoints : []
    setEndpoints(eps)
    const cats = Array.isArray(data.modelCatalog) ? data.modelCatalog : []
    setModelCatalog(cats)
    if (data.providers) setProviders(data.providers)
    const eid = preferId || data.endpointId || data.provider || 'deepseek'
    setEndpointId(eid)
    const modelsFor = cats.filter((m) => m.endpointId === eid)
    const nextModel =
      data.model && modelsFor.some((m) => m.model === data.model)
        ? data.model
        : modelsFor[0]?.model || data.model
    setModel(nextModel)
    const ep = eps.find((e) => e.id === eid)
    setThirdUrlDraft(ep && !OFFICIAL_ORDER.includes(eid as ChatProvider) ? ep.baseUrl : '')
    setThirdKeyDraft('')
    setOfficialKeys({ deepseek: '', openai: '', anthropic: '' })
  }

  useEffect(() => {
    void fetch('/api/chat/config')
      .then((res) => res.json())
      .then((data: ChatPublicConfig) => applyPublic(data))
      .catch(() => setError('加载配置失败'))
  }, [])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setStatus('')

    const setApiKey: Record<string, string> = {}
    for (const p of OFFICIAL) {
      if (officialKeys[p.key].trim()) setApiKey[p.key] = officialKeys[p.key].trim()
    }
    if (!isOfficial && thirdKeyDraft.trim()) setApiKey[endpointId] = thirdKeyDraft.trim()

    const hasOfficial =
      OFFICIAL_ORDER.some((p) => providers?.[p]?.configured || officialKeys[p].trim())
    const hasThird =
      thirdEndpoints.some((e) => e.configured) || Boolean(thirdKeyDraft.trim()) || Object.keys(setApiKey).length > 0
    if (!hasOfficial && !hasThird && current?.group !== 'local') {
      setError('请至少填写一个官方 API Key，或配置第三方连接。')
      return
    }

    const body: Record<string, unknown> = {
      endpointId,
      model,
      ...(Object.keys(setApiKey).length ? { setApiKey } : {}),
    }
    if (!isOfficial && thirdUrlDraft.trim()) {
      body.setBaseUrl = { [endpointId]: thirdUrlDraft.trim() }
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
    applyPublic((await res.json()) as ChatPublicConfig, endpointId)
    setStatus('已保存（.cordis/chat-config.json）')
  }

  async function onAddModel() {
    const name = newModelName.trim()
    if (!name) {
      setError('请填写模型名称')
      return
    }
    setError('')
    const res = await fetch('/api/chat/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ addModel: { endpointId, model: name, label: name } }),
    })
    if (!res.ok) {
      setError(`添加模型失败：HTTP ${res.status}`)
      return
    }
    applyPublic((await res.json()) as ChatPublicConfig, endpointId)
    setNewModelName('')
    setStatus(`已添加模型 ${name}`)
  }

  async function onRemoveModel(id: string) {
    const res = await fetch('/api/chat/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ removeCustomModel: id }),
    })
    if (!res.ok) return
    applyPublic((await res.json()) as ChatPublicConfig, endpointId)
  }

  async function onAddThird() {
    const fromPreset = presetId ? endpoints.find((e) => e.id === presetId) : null
    const label = newEpLabel.trim() || fromPreset?.label || ''
    const baseUrl = newEpUrl.trim() || fromPreset?.defaultBaseUrl || fromPreset?.baseUrl || ''
    if (!label || !baseUrl) {
      setError('请填写第三方名称与 API URL，或选择预设中转站')
      return
    }
    setError('')
    // 预设：只切到该入口并写 Key/URL；自定义：addEndpoint
    if (fromPreset && !newEpLabel.trim()) {
      const body: Record<string, unknown> = { endpointId: fromPreset.id }
      if (newEpKey.trim()) body.setApiKey = { [fromPreset.id]: newEpKey.trim() }
      if (newEpUrl.trim() && newEpUrl.trim() !== fromPreset.defaultBaseUrl) {
        body.setBaseUrl = { [fromPreset.id]: newEpUrl.trim() }
      }
      const first = modelCatalog.find((m) => m.endpointId === fromPreset.id)
      if (first) body.model = first.model
      const res = await fetch('/api/chat/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        setError(`接入失败：HTTP ${res.status}`)
        return
      }
      applyPublic((await res.json()) as ChatPublicConfig, fromPreset.id)
    } else {
      const res = await fetch('/api/chat/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          addEndpoint: {
            label,
            baseUrl,
            protocol: newEpProtocol,
          },
          ...(newEpKey.trim()
            ? {
                // addEndpoint 会切到新 id；紧接着再 patch key 需二次请求
              }
            : {}),
        }),
      })
      if (!res.ok) {
        setError(`添加失败：HTTP ${res.status}`)
        return
      }
      const data = (await res.json()) as ChatPublicConfig
      const newId = data.endpointId
      if (newEpKey.trim() && newId) {
        const res2 = await fetch('/api/chat/config', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ setApiKey: { [newId]: newEpKey.trim() }, endpointId: newId }),
        })
        if (res2.ok) applyPublic((await res2.json()) as ChatPublicConfig, newId)
        else applyPublic(data)
      } else {
        applyPublic(data)
      }
    }
    setShowAddThird(false)
    setPresetId('')
    setNewEpLabel('')
    setNewEpUrl('')
    setNewEpKey('')
    setStatus('第三方已接入，可在上方选择其模型')
  }

  async function onRemoveThird(id: string) {
    const res = await fetch('/api/chat/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ removeCustomEndpoint: id }),
    })
    if (!res.ok) return
    applyPublic((await res.json()) as ChatPublicConfig)
    setStatus('已删除第三方连接')
  }

  const selectOptions = useMemo(() => {
    const official = officialEndpoints
    const configuredThird = thirdEndpoints.filter((e) => e.configured || e.id === endpointId)
    return { official, third: configuredThird }
  }, [officialEndpoints, thirdEndpoints, endpointId])

  return (
    <form
      className="relative flex h-full min-h-[420px] flex-col gap-5 px-1 pb-14"
      data-testid="assistant-config"
      onSubmit={onSubmit}
    >
      {/* ① 官方 Token —— 始终可见 */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <span className={labelCls}>官方 API Key</span>
          <span className="text-[10px] text-[var(--dsw-label-3)]">DeepSeek / Claude / GPT</span>
        </div>
        {OFFICIAL.map((p) => {
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
                {view?.configured ? (
                  <span className="font-normal text-[var(--dsw-label-3)]">· {view.hint}</span>
                ) : null}
              </span>
              <input
                className={inputCls}
                type="password"
                autoComplete="off"
                data-testid={`key-${p.key}`}
                placeholder={view?.configured ? `已配置 · 输入可覆盖` : p.placeholder}
                value={officialKeys[p.key]}
                onChange={(e) => setOfficialKeys((prev) => ({ ...prev, [p.key]: e.target.value }))}
              />
            </label>
          )
        })}
      </section>

      {/* ② 默认模型 —— 下拉可见目录模型 */}
      <section className="flex flex-col gap-2.5">
        <span className={labelCls}>默认模型</span>
        <div className="flex gap-2">
          <label className="flex w-[42%] flex-col gap-1">
            <span className="text-[11px] text-[var(--dsw-label-3)]">提供商 / 入口</span>
            <select
              className={inputCls}
              value={endpointId}
              data-testid="endpoint"
              onChange={(e) => {
                const next = e.target.value
                setEndpointId(next)
                setThirdKeyDraft('')
                const ep = endpoints.find((x) => x.id === next)
                if (ep && !OFFICIAL_ORDER.includes(next as ChatProvider)) {
                  setThirdUrlDraft(ep.baseUrl)
                }
                const def = modelCatalog.find((m) => m.endpointId === next)
                if (def) setModel(def.model)
              }}
            >
              <optgroup label="官方">
                {OFFICIAL.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                    {providers?.[p.key]?.configured ? '（已配置）' : ''}
                  </option>
                ))}
              </optgroup>
              {selectOptions.third.length ? (
                <optgroup label="第三方 / 中转">
                  {selectOptions.third.map((ep) => (
                    <option key={ep.id} value={ep.id}>
                      {ep.label}
                      {ep.configured ? '（已配置）' : ''}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </label>
          <label className="flex w-[58%] flex-col gap-1">
            <span className="text-[11px] text-[var(--dsw-label-3)]">模型</span>
            <select
              className={inputCls}
              value={currentModelInCatalog?.id ?? ''}
              data-testid="model"
              onChange={(e) => {
                const def = modelCatalog.find((m) => m.id === e.target.value)
                if (def) setModel(def.model)
              }}
            >
              {availableModels.length === 0 ? (
                <option value="">暂无模型 — 可在下方添加</option>
              ) : (
                availableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                    {m.note ? ` — ${m.note}` : ''}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>

        {/* 第三方入口：显示 URL + Key 覆盖 */}
        {!isOfficial && current ? (
          <div className="flex flex-col gap-2 rounded-[10px] border border-[var(--dsw-border)] p-3">
            <div className="text-[12px] font-medium text-[var(--dsw-label)]">{current.label}</div>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-[var(--dsw-label-3)]">API URL</span>
              <input
                className={inputCls}
                type="url"
                data-testid="base-url"
                value={thirdUrlDraft}
                placeholder={current.defaultBaseUrl}
                onChange={(e) => setThirdUrlDraft(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-[var(--dsw-label-3)]">API Token</span>
              <input
                className={inputCls}
                type="password"
                autoComplete="off"
                placeholder={current.configured ? `已配置 · ${current.hint}` : current.placeholder}
                value={thirdKeyDraft}
                onChange={(e) => setThirdKeyDraft(e.target.value)}
              />
            </label>
          </div>
        ) : null}

        {/* 在当前入口追加模型名 */}
        <div className="flex gap-2">
          <input
            className={inputCls}
            placeholder="追加模型名称，如 gpt-4o / deepseek-chat"
            value={newModelName}
            onChange={(e) => setNewModelName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void onAddModel()
              }
            }}
          />
          <button type="button" className={ghostBtn} onClick={() => void onAddModel()}>
            <LuPlus className="size-3.5" />
            添加模型
          </button>
        </div>
        {availableModels.some((m) => m.builtin === false) ? (
          <ul className="flex flex-col gap-1">
            {availableModels
              .filter((m) => m.builtin === false)
              .map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between text-[11px] text-[var(--dsw-label-2)]"
                >
                  <span>
                    {m.label} <code className="text-[10px] opacity-70">{m.model}</code>
                  </span>
                  <button
                    type="button"
                    className="text-[var(--dsw-danger,#b42318)]"
                    onClick={() => void onRemoveModel(m.id)}
                  >
                    删除
                  </button>
                </li>
              ))}
          </ul>
        ) : null}
      </section>

      {/* ③ 第三方 / 中转 */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className={labelCls}>第三方 API</span>
          {!showAddThird ? (
            <button type="button" className={ghostBtn} onClick={() => setShowAddThird(true)}>
              <LuPlus className="size-3.5" />
              接入中转 / 自定义
            </button>
          ) : null}
        </div>

        {thirdEndpoints.filter((e) => e.configured || !e.builtin).length ? (
          <ul className="flex flex-col gap-1 rounded-[10px] border border-[var(--dsw-border)] p-1.5">
            {thirdEndpoints
              .filter((e) => e.configured || e.group === 'custom')
              .map((ep) => (
                <li
                  key={ep.id}
                  className={`flex items-center gap-2 rounded-[8px] px-2.5 py-2 text-[12px] ${
                    ep.id === endpointId ? 'bg-[var(--dsw-business-soft)] text-[var(--dsw-business)]' : 'text-[var(--dsw-label)]'
                  }`}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left"
                    onClick={() => {
                      setEndpointId(ep.id)
                      setThirdUrlDraft(ep.baseUrl)
                      const def = modelCatalog.find((m) => m.endpointId === ep.id)
                      if (def) setModel(def.model)
                    }}
                  >
                    <span className="font-medium">{ep.label}</span>
                    <span className="mt-0.5 block truncate text-[10px] opacity-60">{ep.baseUrl}</span>
                  </button>
                  <span
                    className={`size-1.5 shrink-0 rounded-full ${
                      ep.configured ? 'bg-[var(--dsw-ok)]' : 'bg-[var(--dsw-label-3)] opacity-40'
                    }`}
                  />
                  {ep.group === 'custom' || !ep.builtin ? (
                    <button
                      type="button"
                      className="grid size-6 place-items-center rounded-[6px] text-[var(--dsw-label-3)] hover:text-[var(--dsw-danger,#b42318)]"
                      title="删除"
                      onClick={() => void onRemoveThird(ep.id)}
                    >
                      <LuTrash2 className="size-3" />
                    </button>
                  ) : null}
                </li>
              ))}
          </ul>
        ) : (
          <p className="text-[11px] text-[var(--dsw-label-3)]">
            未接入第三方。可用官方 Key，或添加中转站 / 自定义 URL。
          </p>
        )}

        {showAddThird ? (
          <div className="flex flex-col gap-2 rounded-[10px] border border-[var(--dsw-border)] p-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-[var(--dsw-label-3)]">预设中转站（可选）</span>
              <select
                className={inputCls}
                value={presetId}
                onChange={(e) => {
                  const id = e.target.value
                  setPresetId(id)
                  const ep = endpoints.find((x) => x.id === id)
                  if (ep) {
                    setNewEpUrl(ep.defaultBaseUrl || ep.baseUrl)
                    if (!newEpLabel) setNewEpLabel('')
                  }
                }}
              >
                <option value="">自定义…</option>
                {relayPresets.map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    {ep.label}
                    {ep.note ? ` · ${ep.note}` : ''}
                  </option>
                ))}
              </select>
            </label>
            {!presetId ? (
              <>
                <input
                  className={inputCls}
                  placeholder="名称，如 My OneAPI"
                  value={newEpLabel}
                  onChange={(e) => setNewEpLabel(e.target.value)}
                />
                <select
                  className={inputCls}
                  value={newEpProtocol}
                  onChange={(e) => setNewEpProtocol(e.target.value as 'openai-compat' | 'anthropic')}
                >
                  <option value="openai-compat">OpenAI 兼容</option>
                  <option value="anthropic">Anthropic Messages</option>
                </select>
              </>
            ) : null}
            <input
              className={inputCls}
              placeholder="API URL，如 https://api.example.com/v1"
              value={newEpUrl}
              onChange={(e) => setNewEpUrl(e.target.value)}
            />
            <input
              className={inputCls}
              type="password"
              autoComplete="off"
              placeholder="API Token"
              value={newEpKey}
              onChange={(e) => setNewEpKey(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-[8px] px-3 py-[6px] text-[12px] font-medium text-[var(--dsw-bg)]"
                style={{ background: 'var(--dsw-business)' }}
                onClick={() => void onAddThird()}
              >
                确认接入
              </button>
              <button type="button" className={ghostBtn} onClick={() => setShowAddThird(false)}>
                取消
              </button>
            </div>
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
