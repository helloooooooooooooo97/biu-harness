/**
 * Models 设置 UI（对齐 LobeChat / Open WebUI）
 *
 * 交互：
 * 1. 左侧选 Provider（官方置顶；已接入的第三方；+ 添加）
 * 2. 右侧只编辑当前 Provider：Key / Base URL / 模型列表 / 设为默认
 * 3. 一处保存，不再拆成三块互相抢焦点
 */
import { useEffect, useMemo, useState } from 'react'
import { LuCheck, LuLoaderCircle, LuPlus, LuSearch, LuTrash2, LuUnplug } from 'react-icons/lu'

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

const OFFICIAL_IDS = ['deepseek', 'anthropic', 'openai'] as const
type OfficialId = (typeof OFFICIAL_IDS)[number]

const OFFICIAL_META: Record<OfficialId, { label: string; placeholder: string }> = {
  deepseek: { label: 'DeepSeek', placeholder: 'sk-…' },
  anthropic: { label: 'Claude', placeholder: 'sk-ant-…' },
  openai: { label: 'OpenAI', placeholder: 'sk-…' },
}

function isOfficial(id: string): id is OfficialId {
  return (OFFICIAL_IDS as readonly string[]).includes(id)
}

const inputCls = [
  'w-full rounded-[8px] px-2.5 py-[7px] text-[13px] text-[var(--dsw-label)]',
  'border border-[var(--dsw-border)] bg-[var(--dsw-input)] outline-none',
  'placeholder:text-[var(--dsw-label-3)] focus:border-[var(--dsw-business)]',
].join(' ')

export function ChatConfig() {
  const [activeId, setActiveId] = useState('deepseek')
  const [defaultEndpointId, setDefaultEndpointId] = useState('deepseek')
  const [defaultModel, setDefaultModel] = useState('deepseek-chat')
  const [endpoints, setEndpoints] = useState<EndpointView[]>([])
  const [modelCatalog, setModelCatalog] = useState<ModelDef[]>([])
  const [providers, setProviders] = useState<Record<string, ProviderView> | null>(null)

  const [keyDraft, setKeyDraft] = useState('')
  const [urlDraft, setUrlDraft] = useState('')
  const [query, setQuery] = useState('')
  const [newModelName, setNewModelName] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testHint, setTestHint] = useState('')

  const [adding, setAdding] = useState(false)
  const [presetId, setPresetId] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newKey, setNewKey] = useState('')
  const [newProtocol, setNewProtocol] = useState<'openai-compat' | 'anthropic'>('openai-compat')

  const active = endpoints.find((e) => e.id === activeId)
  const activeModels = useMemo(
    () => modelCatalog.filter((m) => m.endpointId === activeId),
    [modelCatalog, activeId],
  )
  const isDefaultProvider = defaultEndpointId === activeId
  const configured = active?.configured ?? providers?.[activeId]?.configured ?? false

  const officialList = useMemo(() => {
    return OFFICIAL_IDS.map((id) => {
      const found = endpoints.find((e) => e.id === id)
      if (found) return found
      return {
        id,
        label: OFFICIAL_META[id].label,
        group: 'official',
        protocol: id === 'anthropic' ? 'anthropic' : 'openai-compat',
        provider: id,
        baseUrl: '',
        defaultBaseUrl: '',
        configured: Boolean(providers?.[id]?.configured),
        hint: providers?.[id]?.hint ?? '',
        placeholder: OFFICIAL_META[id].placeholder,
        note: '官方',
        builtin: true,
      } satisfies EndpointView
    })
  }, [endpoints, providers])

  /** 已接入的第三方：配过 Key，或自定义，或当前默认 */
  const connectedThird = useMemo(
    () =>
      endpoints.filter(
        (e) =>
          !isOfficial(e.id) &&
          (e.configured || e.group === 'custom' || e.id === defaultEndpointId || e.id === activeId),
      ),
    [endpoints, defaultEndpointId, activeId],
  )

  const presets = useMemo(
    () =>
      endpoints.filter(
        (e) =>
          !isOfficial(e.id) &&
          !connectedThird.some((c) => c.id === e.id) &&
          (e.group === 'relay' || e.group === 'local' || e.group === 'official'),
      ),
    [endpoints, connectedThird],
  )

  const filteredOfficial = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return officialList
    return officialList.filter(
      (e) => e.label.toLowerCase().includes(q) || e.id.includes(q),
    )
  }, [officialList, query])

  const filteredThird = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return connectedThird
    return connectedThird.filter(
      (e) =>
        e.label.toLowerCase().includes(q) ||
        e.id.includes(q) ||
        e.baseUrl.toLowerCase().includes(q),
    )
  }, [connectedThird, query])

  function applyPublic(data: ChatPublicConfig, preferActive?: string) {
    const eps = Array.isArray(data.endpoints) ? data.endpoints : []
    setEndpoints(eps)
    const cats = Array.isArray(data.modelCatalog) ? data.modelCatalog : []
    setModelCatalog(cats)
    if (data.providers) setProviders(data.providers)

    const eid = preferActive || data.endpointId || data.provider || 'deepseek'
    setDefaultEndpointId(data.endpointId || data.provider || eid)
    setDefaultModel(data.model)
    setActiveId(eid)

    const ep = eps.find((e) => e.id === eid)
    setUrlDraft(ep?.baseUrl ?? data.baseUrl ?? '')
    setKeyDraft('')
    // 通知 Composer 等刷新模型目录
    window.dispatchEvent(new CustomEvent('biu:chat-config-changed'))
  }

  function selectProvider(id: string) {
    setActiveId(id)
    setAdding(false)
    setError('')
    setStatus('')
    setTestHint('')
    setKeyDraft('')
    setNewModelName('')
    const ep = endpoints.find((e) => e.id === id)
    setUrlDraft(ep?.baseUrl ?? '')
  }

  useEffect(() => {
    void fetch('/api/chat/config')
      .then((res) => res.json())
      .then((data: ChatPublicConfig) => applyPublic(data))
      .catch(() => setError('加载配置失败'))
  }, [])

  async function saveCurrent(opts?: { makeDefault?: boolean; model?: string }) {
    if (!active) return
    setSaving(true)
    setError('')
    setStatus('')
    try {
      const body: Record<string, unknown> = {}
      const nextModel = opts?.model ?? (isDefaultProvider ? defaultModel : activeModels[0]?.model)
      if (opts?.makeDefault || isDefaultProvider) {
        body.endpointId = activeId
        if (nextModel) body.model = nextModel
      }
      if (keyDraft.trim()) body.setApiKey = { [activeId]: keyDraft.trim() }
      if (!isOfficial(activeId)) {
        const base = urlDraft.trim()
        if (base && base !== active.defaultBaseUrl) body.setBaseUrl = { [activeId]: base }
        else if (base === active.defaultBaseUrl && active.baseUrl !== active.defaultBaseUrl) {
          body.setBaseUrl = { [activeId]: null }
        }
      }
      // 至少要有可写内容，或设为默认
      if (
        !body.endpointId &&
        !body.setApiKey &&
        !body.setBaseUrl &&
        !opts?.makeDefault
      ) {
        // 仅切换默认模型（当前已是默认入口）
        if (isDefaultProvider && opts?.model) {
          body.endpointId = activeId
          body.model = opts.model
        } else {
          setStatus('没有需要保存的更改')
          return
        }
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
      applyPublic((await res.json()) as ChatPublicConfig, activeId)
      setStatus(opts?.makeDefault ? '已设为默认并保存' : '已保存')
    } finally {
      setSaving(false)
    }
  }

  async function pickDefaultModel(m: ModelDef) {
    setDefaultModel(m.model)
    setSaving(true)
    setError('')
    try {
      const body: Record<string, unknown> = {
        endpointId: activeId,
        model: m.model,
      }
      if (keyDraft.trim()) body.setApiKey = { [activeId]: keyDraft.trim() }
      if (!isOfficial(activeId) && urlDraft.trim()) {
        body.setBaseUrl = { [activeId]: urlDraft.trim() }
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
      applyPublic((await res.json()) as ChatPublicConfig, activeId)
      setStatus(`默认模型：${m.label}`)
    } finally {
      setSaving(false)
    }
  }

  async function onTestConnection() {
    if (!active || testing) return
    setTesting(true)
    setTestHint('')
    setError('')
    try {
      const res = await fetch('/api/chat/config/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          endpointId: activeId,
          ...(keyDraft.trim() ? { apiKey: keyDraft.trim() } : {}),
          ...(!isOfficial(activeId) && urlDraft.trim() ? { baseUrl: urlDraft.trim() } : {}),
          ...(isDefaultProvider && defaultModel ? { model: defaultModel } : {}),
          ...(!isDefaultProvider && activeModels[0]?.model ? { model: activeModels[0].model } : {}),
        }),
      })
      const data = (await res.json()) as { ok?: boolean; detail?: string; latencyMs?: number }
      if (data.ok) {
        setTestHint(data.detail || '连接成功')
        setStatus('连接正常')
      } else {
        setTestHint('')
        setError(data.detail || `连接失败（HTTP ${res.status}）`)
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setTesting(false)
    }
  }

  async function onAddModel() {
    const name = newModelName.trim()
    if (!name) {
      setError('请填写模型 ID')
      return
    }
    setError('')
    const res = await fetch('/api/chat/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ addModel: { endpointId: activeId, model: name, label: name } }),
    })
    if (!res.ok) {
      setError(`添加失败：HTTP ${res.status}`)
      return
    }
    applyPublic((await res.json()) as ChatPublicConfig, activeId)
    setNewModelName('')
    setStatus(`已添加 ${name}`)
  }

  async function onRemoveModel(id: string) {
    const res = await fetch('/api/chat/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ removeCustomModel: id }),
    })
    if (!res.ok) return
    applyPublic((await res.json()) as ChatPublicConfig, activeId)
  }

  async function onAddConnection() {
    const fromPreset = presetId ? endpoints.find((e) => e.id === presetId) : null
    const label = newLabel.trim() || fromPreset?.label || ''
    const baseUrl = newUrl.trim() || fromPreset?.defaultBaseUrl || fromPreset?.baseUrl || ''
    if (!label || !baseUrl) {
      setError('请选择预设或填写名称与 Base URL')
      return
    }
    setError('')

    if (fromPreset && !newLabel.trim()) {
      const body: Record<string, unknown> = { endpointId: fromPreset.id }
      if (newKey.trim()) body.setApiKey = { [fromPreset.id]: newKey.trim() }
      if (newUrl.trim() && newUrl.trim() !== fromPreset.defaultBaseUrl) {
        body.setBaseUrl = { [fromPreset.id]: newUrl.trim() }
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
          addEndpoint: { label, baseUrl, protocol: newProtocol },
        }),
      })
      if (!res.ok) {
        setError(`添加失败：HTTP ${res.status}`)
        return
      }
      let data = (await res.json()) as ChatPublicConfig
      const newId = data.endpointId
      if (newKey.trim() && newId) {
        const res2 = await fetch('/api/chat/config', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ setApiKey: { [newId]: newKey.trim() }, endpointId: newId }),
        })
        if (res2.ok) data = (await res2.json()) as ChatPublicConfig
      }
      applyPublic(data, newId)
    }

    setAdding(false)
    setPresetId('')
    setNewLabel('')
    setNewUrl('')
    setNewKey('')
    setStatus('已接入')
  }

  async function onRemoveConnection(id: string) {
    const res = await fetch('/api/chat/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ removeCustomEndpoint: id }),
    })
    if (!res.ok) return
    applyPublic((await res.json()) as ChatPublicConfig)
    setStatus('已删除')
  }

  function providerRow(ep: EndpointView) {
    const activeRow = ep.id === activeId && !adding
    const isDef = ep.id === defaultEndpointId
    const ok = ep.configured || providers?.[ep.id]?.configured
    return (
      <button
        key={ep.id}
        type="button"
        className={`flex w-full items-center gap-2 px-3 py-[8px] text-left text-[12px] transition-colors ${
          activeRow
            ? 'bg-[var(--dsw-business-soft)] text-[var(--dsw-business)]'
            : 'text-[var(--dsw-label)] hover:bg-[var(--dsw-hover)]'
        }`}
        onClick={() => selectProvider(ep.id)}
      >
        <span
          className={`size-1.5 shrink-0 rounded-full ${
            ok ? 'bg-[var(--dsw-ok)]' : 'bg-[var(--dsw-label-3)] opacity-35'
          }`}
        />
        <span className="min-w-0 flex-1 truncate font-medium">{ep.label}</span>
        {isDef ? (
          <span className="shrink-0 text-[9px] font-semibold tracking-wide opacity-70">默认</span>
        ) : null}
        {activeRow ? <LuCheck className="size-3 shrink-0 opacity-80" /> : null}
      </button>
    )
  }

  return (
    <div className="flex h-full min-h-[460px] flex-col" data-testid="assistant-config">
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-[12px] border border-[var(--dsw-border)]">
        {/* 左：Provider 列表 */}
        <aside className="flex w-[200px] shrink-0 flex-col border-r border-[var(--dsw-border)] bg-[var(--dsw-sidebar)]">
          <div className="border-b border-[var(--dsw-border)] p-2.5">
            <div className="relative">
              <LuSearch className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-[var(--dsw-label-3)]" />
              <input
                className={`${inputCls} pl-7`}
                placeholder="搜索…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="搜索 Provider"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto py-1">
            <div className="px-3 pt-2 pb-1 text-[10px] font-semibold tracking-wide text-[var(--dsw-label-3)] uppercase">
              官方
            </div>
            {filteredOfficial.map(providerRow)}

            {filteredThird.length > 0 ? (
              <>
                <div className="px-3 pt-3 pb-1 text-[10px] font-semibold tracking-wide text-[var(--dsw-label-3)] uppercase">
                  第三方
                </div>
                {filteredThird.map(providerRow)}
              </>
            ) : null}
          </div>

          <div className="border-t border-[var(--dsw-border)] p-2">
            <button
              type="button"
              className={`flex w-full items-center justify-center gap-1 rounded-[8px] px-2.5 py-[7px] text-[12px] font-medium transition-colors ${
                adding
                  ? 'bg-[var(--dsw-business-soft)] text-[var(--dsw-business)]'
                  : 'text-[var(--dsw-label-2)] hover:bg-[var(--dsw-hover)] hover:text-[var(--dsw-label)]'
              }`}
              onClick={() => {
                setAdding(true)
                setError('')
                setStatus('')
              }}
            >
              <LuPlus className="size-3.5" />
              添加连接
            </button>
          </div>
        </aside>

        {/* 右：详情 */}
        <div className="flex min-w-0 flex-1 flex-col">
          {adding ? (
            <>
              <div className="border-b border-[var(--dsw-border)] px-4 py-3">
                <h3 className="text-[14px] font-semibold text-[var(--dsw-label)]">添加连接</h3>
                <p className="mt-0.5 text-[11px] text-[var(--dsw-label-3)]">
                  选中转站预设，或填自定义 Base URL + Token
                </p>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-[var(--dsw-label-3)]">预设</span>
                  <select
                    className={inputCls}
                    value={presetId}
                    onChange={(e) => {
                      const id = e.target.value
                      setPresetId(id)
                      const ep = endpoints.find((x) => x.id === id)
                      if (ep) {
                        setNewUrl(ep.defaultBaseUrl || ep.baseUrl)
                        setNewLabel('')
                      } else {
                        setNewUrl('')
                      }
                    }}
                  >
                    <option value="">自定义 URL…</option>
                    {presets.map((ep) => (
                      <option key={ep.id} value={ep.id}>
                        {ep.label}
                        {ep.note ? ` · ${ep.note}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                {!presetId ? (
                  <>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-semibold text-[var(--dsw-label-3)]">名称</span>
                      <input
                        className={inputCls}
                        placeholder="My OneAPI"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-semibold text-[var(--dsw-label-3)]">协议</span>
                      <select
                        className={inputCls}
                        value={newProtocol}
                        onChange={(e) => setNewProtocol(e.target.value as 'openai-compat' | 'anthropic')}
                      >
                        <option value="openai-compat">OpenAI 兼容</option>
                        <option value="anthropic">Anthropic Messages</option>
                      </select>
                    </label>
                  </>
                ) : null}
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-[var(--dsw-label-3)]">Base URL</span>
                  <input
                    className={inputCls}
                    placeholder="https://api.example.com/v1"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-[var(--dsw-label-3)]">API Key</span>
                  <input
                    className={inputCls}
                    type="password"
                    autoComplete="off"
                    placeholder="sk-…"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                  />
                </label>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-[var(--dsw-border)] px-4 py-2.5">
                {error ? (
                  <span className="mr-auto text-[11px] text-[var(--dsw-danger,#b42318)]">{error}</span>
                ) : null}
                <button
                  type="button"
                  className="rounded-[8px] px-3 py-[6px] text-[12px] text-[var(--dsw-label-2)] hover:bg-[var(--dsw-hover)]"
                  onClick={() => setAdding(false)}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="rounded-[8px] px-3.5 py-[7px] text-[13px] font-medium text-[var(--dsw-bg)]"
                  style={{ background: 'var(--dsw-business)' }}
                  onClick={() => void onAddConnection()}
                >
                  接入
                </button>
              </div>
            </>
          ) : active ? (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-[var(--dsw-border)] px-4 py-3">
                <div className="min-w-0">
                  <h3 className="truncate text-[14px] font-semibold text-[var(--dsw-label)]">
                    {isOfficial(active.id) ? OFFICIAL_META[active.id].label : active.label}
                  </h3>
                  <p className="mt-0.5 truncate text-[11px] text-[var(--dsw-label-3)]">
                    {active.note || active.baseUrl}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-[6px] px-2 py-0.5 text-[10px] font-medium ${
                      configured
                        ? 'bg-[color-mix(in_srgb,var(--dsw-ok)_16%,transparent)] text-[var(--dsw-ok)]'
                        : 'bg-[var(--dsw-hover)] text-[var(--dsw-label-3)]'
                    }`}
                  >
                    {configured ? '已配置' : '未配置'}
                  </span>
                  {isDefaultProvider ? (
                    <span className="rounded-[6px] bg-[var(--dsw-business-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--dsw-business)]">
                      当前默认
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-3">
                <label className="flex flex-col gap-1.5">
                  <span className="flex items-center justify-between text-[11px] font-semibold text-[var(--dsw-label-3)]">
                    <span>API Key</span>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-[6px] px-1.5 py-0.5 text-[11px] font-medium text-[var(--dsw-label-2)] hover:bg-[var(--dsw-hover)] hover:text-[var(--dsw-business)] disabled:opacity-50"
                      title="测试连接"
                      aria-label="测试连接"
                      data-testid="test-connection"
                      disabled={testing}
                      onClick={() => void onTestConnection()}
                    >
                      {testing ? (
                        <LuLoaderCircle className="size-3.5 animate-spin" />
                      ) : (
                        <LuUnplug className="size-3.5" />
                      )}
                      {testing ? '测试中' : '测试连接'}
                    </button>
                  </span>
                  <input
                    className={inputCls}
                    type="password"
                    autoComplete="off"
                    data-testid={isOfficial(active.id) ? `key-${active.id}` : 'key-third'}
                    placeholder={
                      configured
                        ? `已配置 · 输入新 Key 可覆盖（${active.hint || active.placeholder}）`
                        : isOfficial(active.id)
                          ? OFFICIAL_META[active.id].placeholder
                          : active.placeholder
                    }
                    value={keyDraft}
                    onChange={(e) => setKeyDraft(e.target.value)}
                  />
                  {testHint ? (
                    <span className="text-[11px] text-[var(--dsw-ok)]">{testHint}</span>
                  ) : null}
                </label>

                {!isOfficial(active.id) ? (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-semibold text-[var(--dsw-label-3)]">Base URL</span>
                    <input
                      className={inputCls}
                      type="url"
                      data-testid="base-url"
                      value={urlDraft}
                      placeholder={active.defaultBaseUrl}
                      onChange={(e) => setUrlDraft(e.target.value)}
                    />
                  </label>
                ) : (
                  <p className="text-[11px] text-[var(--dsw-label-3)]">
                    官方地址：<span className="font-mono text-[10px]">{active.defaultBaseUrl}</span>
                  </p>
                )}

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[var(--dsw-label-3)]">
                      模型
                      <span className="ml-1 font-normal">· {activeModels.length}</span>
                    </span>
                    <span className="text-[10px] text-[var(--dsw-label-3)]">点击设为默认</span>
                  </div>

                  {activeModels.length ? (
                    <ul className="flex max-h-[220px] flex-col gap-0.5 overflow-y-auto rounded-[8px] border border-[var(--dsw-border)] p-1">
                      {activeModels.map((m) => {
                        const selected = isDefaultProvider && m.model === defaultModel
                        return (
                          <li key={m.id}>
                            <button
                              type="button"
                              data-testid={selected ? 'model-active' : undefined}
                              className={`flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left transition-colors ${
                                selected
                                  ? 'bg-[var(--dsw-business-soft)] text-[var(--dsw-business)]'
                                  : 'text-[var(--dsw-label)] hover:bg-[var(--dsw-hover)]'
                              }`}
                              onClick={() => void pickDefaultModel(m)}
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[12px] font-medium">{m.label}</span>
                                <span className="block truncate font-mono text-[10px] opacity-55">
                                  {m.model}
                                  {m.note ? ` · ${m.note}` : ''}
                                </span>
                              </span>
                              {m.builtin === false ? (
                                <span
                                  role="button"
                                  tabIndex={0}
                                  className="grid size-6 shrink-0 place-items-center rounded-[6px] text-[var(--dsw-label-3)] hover:text-[var(--dsw-danger,#b42318)]"
                                  title="删除"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    void onRemoveModel(m.id)
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      void onRemoveModel(m.id)
                                    }
                                  }}
                                >
                                  <LuTrash2 className="size-3" />
                                </span>
                              ) : selected ? (
                                <LuCheck className="size-3.5 shrink-0" />
                              ) : null}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-[var(--dsw-label-3)]">暂无模型，在下方添加 model id</p>
                  )}

                  <div className="flex gap-2">
                    <input
                      className={inputCls}
                      placeholder="添加模型 ID"
                      value={newModelName}
                      onChange={(e) => setNewModelName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          void onAddModel()
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="inline-flex shrink-0 items-center gap-1 rounded-[8px] border border-[var(--dsw-border)] px-2.5 py-[6px] text-[12px] text-[var(--dsw-label)] hover:bg-[var(--dsw-hover)]"
                      onClick={() => void onAddModel()}
                    >
                      <LuPlus className="size-3.5" />
                      添加
                    </button>
                  </div>
                </div>

                {!isOfficial(active.id) && (active.group === 'custom' || !active.builtin) ? (
                  <button
                    type="button"
                    className="self-start text-[11px] text-[var(--dsw-danger,#b42318)] hover:underline"
                    onClick={() => void onRemoveConnection(active.id)}
                  >
                    删除此连接
                  </button>
                ) : null}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[var(--dsw-border)] px-4 py-2.5">
                {status ? <span className="mr-auto text-[11px] text-[var(--dsw-ok)]">{status}</span> : null}
                {error ? (
                  <span className="mr-auto text-[11px] text-[var(--dsw-danger,#b42318)]">{error}</span>
                ) : null}
                {!isDefaultProvider ? (
                  <button
                    type="button"
                    className="rounded-[8px] border border-[var(--dsw-border)] px-3 py-[6px] text-[12px] text-[var(--dsw-label)] hover:bg-[var(--dsw-hover)]"
                    disabled={saving}
                    onClick={() => void saveCurrent({ makeDefault: true })}
                  >
                    设为默认
                  </button>
                ) : null}
                <button
                  type="button"
                  className="rounded-[8px] px-3.5 py-[7px] text-[13px] font-medium text-[var(--dsw-bg)] transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'var(--dsw-business)' }}
                  disabled={saving}
                  onClick={() => void saveCurrent()}
                >
                  {saving ? '保存中…' : '保存'}
                </button>
              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center text-[12px] text-[var(--dsw-label-3)]">
              从左侧选择 Provider
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
