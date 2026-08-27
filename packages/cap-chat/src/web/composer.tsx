import { memo, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { LuChevronDown, LuPlus, LuSettings } from 'react-icons/lu'
import { useLocation, useNavigate } from 'react-router-dom'
import type { SlotProps } from '@biu/web-slots'
import { bindSessionView, type SessionViewService } from '@biu/web-session-view'
import { formatPicks, PickChipLabel, usePickState, type PickService } from '@biu/cap-pick/web'
import { ModelConfigDialog } from './model-config-dialog.tsx'

/** 按键不驱动受控 value；仅防抖更新发送按钮可用态，避免每个字符打穿 React 渲染。 */
const INPUT_DEBOUNCE_MS = 120

/** 草稿持久化：跟随 session 存 localStorage，停止输入该时长后写入。草稿内容完整保存、完整恢复，不限制长度。 */
const DRAFT_KEY = 'chat.draft'
const DRAFT_DEBOUNCE_MS = 300

function readDraftMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const out: Record<string, string> = {}
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string') out[k] = v
      }
      return out
    }
  } catch {
    /* 忽略：localStorage 不可用则静默降级，不影响输入 */
  }
  return {}
}

function writeDraft(sessionId: string, text: string) {
  try {
    const map = readDraftMap()
    map[sessionId] = text
    localStorage.setItem(DRAFT_KEY, JSON.stringify(map))
  } catch {
    /* 忽略：localStorage 不可用则静默降级，不影响输入 */
  }
}

function clearDraft(sessionId: string) {
  try {
    const map = readDraftMap()
    if (!(sessionId in map)) return
    delete map[sessionId]
    localStorage.setItem(DRAFT_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

type ToolCatalogItem = { name: string; description: string }
type ChatProvider = 'deepseek' | 'openai' | 'anthropic'

type ModelOption = {
  id: string
  label: string
  provider: ChatProvider
  endpointId: string
  model: string
  note?: string
}

type SlashState = {
  open: boolean
  query: string
  start: number
  end: number
}

function readSlashAtCursor(value: string, cursor: number): SlashState | null {
  const before = value.slice(0, cursor)
  const match = /(?:^|\s)\/([^\s/]*)$/.exec(before)
  if (!match) return null
  const token = match[1] ?? ''
  const start = before.length - token.length - 1
  return { open: true, query: token, start, end: cursor }
}

function matchModelOption(catalog: ModelOption[], provider: string, model: string): ModelOption {
  return (
    catalog.find((item) => item.provider === provider && item.model === model) ??
    catalog.find((item) => item.model === model) ?? {
      id: `${provider}:${model}`,
      label: model,
      provider: (provider as ChatProvider) ?? 'deepseek',
      endpointId: provider || 'deepseek',
      model,
    }
  )
}

export const ChatComposer = memo(function ChatComposer(props: SlotProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const canSubmitRef = useRef(false)
  const [canSubmit, setCanSubmit] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [catalog, setCatalog] = useState<ToolCatalogItem[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [slash, setSlash] = useState<SlashState | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [modelOpen, setModelOpen] = useState(false)
  const [modelOption, setModelOption] = useState<ModelOption>({
    id: 'deepseek-flash',
    label: 'DeepSeek Flash',
    provider: 'deepseek',
    endpointId: 'deepseek',
    model: 'deepseek-v4-flash',
  })
  const [modelBusy, setModelBusy] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  /** 全部目录模型（含未配置的），用于下拉只展示已配置入口，但当前选中可能来自任一。 */
  const [allModels, setAllModels] = useState<ModelOption[]>([])
  /** 各入口是否已配置 token（key = endpointId）。 */
  const [modelProviders, setModelProviders] = useState<Record<string, boolean> | null>(null)
  /** 入口展示名 */
  const [endpointLabels, setEndpointLabels] = useState<Record<string, string>>({})
  const useSessionView = props.useSessionView as ReturnType<typeof bindSessionView>
  const pending = useSessionView((state) => state.pending)
  const inbox = useSessionView((state) => state.inbox)
  const sessionId = useSessionView((state) => state.sessionId)
  const sessionView = props.sessionView as SessionViewService
  const pick = props.pick as PickService | undefined
  const { refs: pickRefs } = usePickState(pick)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const open = () => {
      setModelOpen(false)
      setConfigOpen(true)
    }
    window.addEventListener('biu:open-model-config', open)
    return () => window.removeEventListener('biu:open-model-config', open)
  }, [])

  function openModelConfig() {
    setModelOpen(false)
    setConfigOpen(true)
  }

  function syncComposerShape(
    el: HTMLTextAreaElement | null = textareaRef.current,
    toolsCount = picked.length + pickRefs.length,
  ) {
    if (!el) {
      setExpanded(toolsCount > 0)
      return
    }
    el.style.height = 'auto'
    const next = Math.min(el.scrollHeight, 140)
    el.style.height = `${Math.max(28, next)}px`
    const multi = next > 36 || el.value.includes('\n') || toolsCount > 0
    setExpanded(multi)
  }

  useEffect(
    () => () => {
      if (debounceRef.current != null) clearTimeout(debounceRef.current)
      if (draftTimerRef.current != null) clearTimeout(draftTimerRef.current)
    },
    [],
  )

  // 挂载/session 切换时恢复该 session 草稿并同步高度/形状
  useEffect(() => {
    const el = textareaRef.current
    if (!el || !sessionId) return
    const draft = readDraftMap()[sessionId]
    if (typeof draft === 'string' && draft) {
      el.value = draft
      syncComposerShape(el)
    }
    // 仅关注 session 切换；首挂载 sessionId 初始值也会触发一次（无害）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  useEffect(() => {
    let cancelled = false

    function applyConfig(data: {
      toolCatalog?: ToolCatalogItem[]
      provider?: string
      endpointId?: string
      model?: string
      providers?: Record<string, { configured?: boolean }>
      endpoints?: Array<{ id: string; label?: string; configured?: boolean }>
      modelCatalog?: Array<{
        id: string
        label: string
        provider: string
        endpointId?: string
        model: string
        note?: string
        endpointConfigured?: boolean
      }>
    }) {
      if (cancelled) return
      const items = Array.isArray(data.toolCatalog) ? data.toolCatalog : []
      setCatalog(items.filter((item) => item?.name))
      if (Array.isArray(data.modelCatalog) && data.modelCatalog.length) {
        const catalog = data.modelCatalog.map((m) => ({
          id: m.id,
          label: m.label,
          provider: m.provider as ChatProvider,
          endpointId: m.endpointId || m.provider,
          model: m.model,
          ...(m.note ? { note: m.note } : {}),
        }))
        setAllModels(catalog)
        if (data.provider && data.model)
          setModelOption(matchModelOption(catalog, data.provider, data.model))
      } else if (data.provider && data.model) {
        setModelOption(matchModelOption([], data.provider, data.model))
      }
      const cfg: Record<string, boolean> = {}
      const labels: Record<string, string> = {
        deepseek: 'DeepSeek',
        anthropic: 'Claude',
        openai: 'GPT',
      }
      if (Array.isArray(data.endpoints)) {
        for (const ep of data.endpoints) {
          cfg[ep.id] = Boolean(ep?.configured)
          if (ep.label) labels[ep.id] = ep.label
        }
      }
      if (data.providers) {
        for (const [k, v] of Object.entries(data.providers)) cfg[k] = Boolean(v?.configured)
      }
      if (Object.keys(cfg).length) setModelProviders(cfg)
      setEndpointLabels(labels)
    }

    function reload() {
      void fetch('/api/chat/config')
        .then((res) => res.json())
        .then(applyConfig)
        .catch(() => {
          /* ignore */
        })
    }

    reload()
    const onConfigChanged = () => reload()
    window.addEventListener('biu:chat-config-changed', onConfigChanged)
    return () => {
      cancelled = true
      window.removeEventListener('biu:chat-config-changed', onConfigChanged)
    }
  }, [])

  useEffect(() => {
    if (!modelOpen) return
    // 打开下拉时强制刷新，保证 Settings 里新加的模型立刻可见
    void fetch('/api/chat/config')
      .then((res) => res.json())
      .then(
        (data: {
          provider?: string
          model?: string
          providers?: Record<string, { configured?: boolean }>
          endpoints?: Array<{ id: string; label?: string; configured?: boolean }>
          modelCatalog?: Array<{
            id: string
            label: string
            provider: string
            endpointId?: string
            model: string
            note?: string
          }>
        }) => {
          if (Array.isArray(data.modelCatalog) && data.modelCatalog.length) {
            const catalog = data.modelCatalog.map((m) => ({
              id: m.id,
              label: m.label,
              provider: m.provider as ChatProvider,
              endpointId: m.endpointId || m.provider,
              model: m.model,
              ...(m.note ? { note: m.note } : {}),
            }))
            setAllModels(catalog)
            if (data.provider && data.model)
              setModelOption(matchModelOption(catalog, data.provider, data.model))
          }
          const cfg: Record<string, boolean> = {}
          const labels: Record<string, string> = { ...endpointLabels }
          if (Array.isArray(data.endpoints)) {
            for (const ep of data.endpoints) {
              cfg[ep.id] = Boolean(ep?.configured)
              if (ep.label) labels[ep.id] = ep.label
            }
          }
          if (data.providers) {
            for (const [k, v] of Object.entries(data.providers)) cfg[k] = Boolean(v?.configured)
          }
          if (Object.keys(cfg).length) setModelProviders(cfg)
          setEndpointLabels(labels)
        },
      )
      .catch(() => {
        /* ignore */
      })
    const onPointer = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('.composer-model')) return
      setModelOpen(false)
    }
    window.addEventListener('mousedown', onPointer)
    return () => window.removeEventListener('mousedown', onPointer)
    // endpointLabels 仅作合并基础，不纳入依赖避免循环刷新
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelOpen])

  const filtered = useMemo(() => {
    if (!slash?.open) return []
    const q = slash.query.trim().toLowerCase()
    const base = catalog.filter((item) => !picked.includes(item.name))
    if (!q) return base.slice(0, 12)
    return base
      .filter((item) => item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q))
      .slice(0, 12)
  }, [catalog, picked, slash])

  useEffect(() => {
    setActiveIndex(0)
  }, [slash?.query, slash?.open, filtered.length])

  function scheduleCanSubmit(value: string, tools: string[] = picked, picks = pickRefs.length) {
    const next = Boolean(value.trim()) || tools.length > 0 || picks > 0
    if (debounceRef.current != null) clearTimeout(debounceRef.current)
    if (next === canSubmitRef.current) {
      if (next) {
        canSubmitRef.current = true
        setCanSubmit(true)
      }
      return
    }
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      canSubmitRef.current = next
      setCanSubmit(next)
    }, INPUT_DEBOUNCE_MS)
  }

  useEffect(() => {
    scheduleCanSubmit(textareaRef.current?.value ?? '', picked, pickRefs.length)
    syncComposerShape(textareaRef.current, picked.length + pickRefs.length)
  }, [pickRefs.length, picked.length])

  /** 输入防抖写草稿：停止输入约 300ms 后写入当前 session 的 localStorage 草稿。 */
  function schedulePersistDraft(text: string) {
    if (!sessionId) return
    if (draftTimerRef.current != null) clearTimeout(draftTimerRef.current)
    draftTimerRef.current = setTimeout(() => {
      draftTimerRef.current = null
      writeDraft(sessionId, text)
    }, DRAFT_DEBOUNCE_MS)
  }

  /** 清理挂起的草稿写定时器（切会话/发送时不残留脏写）。 */
  function flushDraftTimer() {
    if (draftTimerRef.current != null) {
      clearTimeout(draftTimerRef.current)
      draftTimerRef.current = null
    }
  }

  function clearInput() {
    if (debounceRef.current != null) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    flushDraftTimer()
    const el = textareaRef.current
    if (el) {
      el.value = ''
      el.style.height = '28px'
    }
    canSubmitRef.current = false
    setCanSubmit(false)
    setSlash(null)
    setPicked([])
    setExpanded(false)
  }

  const openSlashMenu = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart ?? el.value.length
    const needsSpace = start > 0 && !/\s$/.test(el.value.slice(0, start))
    const insert = `${needsSpace ? ' ' : ''}/`
    el.value = `${el.value.slice(0, start)}${insert}${el.value.slice(el.selectionEnd ?? start)}`
    const caret = start + insert.length
    el.focus()
    el.setSelectionRange(caret, caret)
    scheduleCanSubmit(el.value)
    syncComposerShape(el)
    setSlash(readSlashAtCursor(el.value, caret))
    if (catalog.length === 0) {
      void fetch('/api/chat/config')
        .then((res) => res.json())
        .then((data: { toolCatalog?: ToolCatalogItem[] }) => {
          const items = Array.isArray(data.toolCatalog) ? data.toolCatalog : []
          setCatalog(items.filter((item) => item?.name))
        })
        .catch(() => {
          /* ignore */
        })
    }
  }, [catalog.length, picked])

  const syncSlashFromTextarea = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    const next = readSlashAtCursor(el.value, el.selectionStart ?? el.value.length)
    setSlash(next)
    if (next?.open && catalog.length === 0) {
      void fetch('/api/chat/config')
        .then((res) => res.json())
        .then((data: { toolCatalog?: ToolCatalogItem[] }) => {
          const items = Array.isArray(data.toolCatalog) ? data.toolCatalog : []
          setCatalog(items.filter((item) => item?.name))
        })
        .catch(() => {
          /* ignore */
        })
    }
  }, [catalog.length])

  const pickTool = useCallback(
    (name: string, slashState: SlashState | null = slash) => {
      const el = textareaRef.current
      setPicked((prev) => {
        const nextTools = prev.includes(name) ? prev : [...prev, name]
        if (el && slashState) {
          const before = el.value.slice(0, slashState.start)
          const after = el.value.slice(slashState.end)
          el.value = `${before}${after}`.replace(/\s{2,}/g, ' ')
          const caret = Math.min(before.length, el.value.length)
          el.focus()
          el.setSelectionRange(caret, caret)
          scheduleCanSubmit(el.value, nextTools)
          syncComposerShape(el, nextTools.length)
        } else {
          scheduleCanSubmit(el?.value ?? '', nextTools)
          syncComposerShape(el, nextTools.length)
        }
        return nextTools
      })
      setSlash(null)
    },
    [slash, picked],
  )

  async function selectModel(option: ModelOption) {
    if (modelBusy || option.id === modelOption.id) {
      setModelOpen(false)
      return
    }
    setModelBusy(true)
    try {
      const res = await fetch('/api/chat/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          endpointId: option.endpointId,
          provider: option.provider,
          model: option.model,
        }),
      })
      if (!res.ok) return
      const data = (await res.json()) as { provider?: string; model?: string }
      if (data.provider && data.model) setModelOption(matchModelOption(allModels, data.provider, data.model))
      else setModelOption(option)
      setModelOpen(false)
    } finally {
      setModelBusy(false)
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (slash?.open && filtered.length) {
      const item = filtered[activeIndex] ?? filtered[0]
      if (item) pickTool(item.name)
      return
    }
    if (debounceRef.current != null) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    const content = (textareaRef.current?.value ?? '').trim()
    // 空回车 + 队列有 wake：abort 当前回合并立刻 claim
    if (!content && !picked.length && !pickRefs.length) {
      if (inbox.some((item) => item.kind === 'wake')) {
        try {
          await sessionView.flushInbox()
        } catch {
          /* error 已写入 sessionView */
        }
      }
      return
    }
    const tools = [...picked]
    const fallback = tools.length ? `请使用工具：${tools.join(', ')}` : ''
    const text = [formatPicks(pickRefs), content || fallback].filter(Boolean).join('\n')
    clearInput()
    pick?.clear()
    try {
      await sessionView.send(text, 'wake', tools)
      const id = sessionView.get().sessionId
      if (id) {
        clearDraft(id)
        flushDraftTimer()
      }
      if (id && !location.pathname.startsWith(`/s/${id}`)) navigate(`/s/${id}`)
    } catch {
      /* error 已写入 sessionView */
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (slash?.open && filtered.length) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((i) => (i + 1) % filtered.length)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setSlash(null)
        return
      }
      if (event.key === 'Enter' && !event.shiftKey) {
        if (event.nativeEvent.isComposing || event.keyCode === 229) return
        event.preventDefault()
        const item = filtered[activeIndex] ?? filtered[0]
        if (item) pickTool(item.name)
        return
      }
      if (event.key === 'Tab') {
        event.preventDefault()
        const item = filtered[activeIndex] ?? filtered[0]
        if (item) pickTool(item.name)
        return
      }
    }

    if (event.key !== 'Enter' || event.shiftKey) return
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    event.preventDefault()
    event.currentTarget.form?.requestSubmit()
  }

  return (
    <div className="composer-stack" data-biu-ignore>
      {inbox.length > 0 ? (
        <div className="composer-inbox" aria-label="排队中">
          <div className="composer-inbox-head">排队中 · {inbox.length}</div>
          <ul className="composer-inbox-list">
            {inbox.map((item) => (
              <li key={item.id} className="composer-inbox-item">
                <span className={`composer-inbox-kind composer-inbox-kind-${item.kind}`}>
                  {item.kind}
                </span>
                <span className="composer-inbox-text" title={item.text}>
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form
        className={`composer-pill${expanded ? ' is-expanded' : ''}${pickRefs.length || picked.length ? ' has-chips' : ''}`}
        onSubmit={onSubmit}
      >
      {slash?.open ? (
        <div className="composer-slash" role="listbox" aria-label="工具列表">
          <div className="composer-slash-head">工具 · 输入过滤 · Enter 选用</div>
          {filtered.length === 0 ? (
            <div className="composer-slash-empty">没有匹配的工具</div>
          ) : (
            filtered.map((item, index) => (
              <button
                key={item.name}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={`composer-slash-item${index === activeIndex ? ' is-active' : ''}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => pickTool(item.name)}
              >
                <span className="composer-slash-name">/{item.name}</span>
                <span className="composer-slash-desc">{item.description || '—'}</span>
              </button>
            ))
          )}
        </div>
      ) : null}

      {picked.length ? (
        <div className="composer-tool-chips" aria-label="本回合额外工具">
          {picked.map((name) => (
            <button
              key={name}
              type="button"
              className="composer-tool-chip"
              title={`移除 ${name}`}
              onClick={() => {
                setPicked((prev) => {
                  const next = prev.filter((item) => item !== name)
                  scheduleCanSubmit(textareaRef.current?.value ?? '', next)
                  syncComposerShape(textareaRef.current, next.length)
                  return next
                })
              }}
            >
              <span>/{name}</span>
              <span aria-hidden>×</span>
            </button>
          ))}
        </div>
      ) : null}

      {pickRefs.length ? (
        <div className="composer-tool-chips" aria-label="已选取对象" data-biu-ignore>
          {pickRefs.map((ref) => (
            <button
              key={`${ref.kind}:${ref.id}:${ref.action ?? ''}`}
              type="button"
              className="composer-tool-chip"
              title="移除选取"
              data-testid="pick-chip"
              title={`${ref.kind} · ${ref.label}${ref.action ? ` · ${ref.action}` : ''}`}
              onClick={() => pick?.remove(`${ref.kind}:${ref.id}:${ref.action ?? ''}`)}
            >
              <PickChipLabel pick={ref} />
              <span aria-hidden>×</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="composer-pill-row">
        <button
          type="button"
          className="composer-plus"
          title="添加工具 (/)"
          aria-label="添加工具"
          onClick={openSlashMenu}
        >
          <LuPlus className="size-4" />
        </button>

        <textarea
          ref={textareaRef}
          className="composer-pill-input"
          defaultValue=""
          rows={1}
          placeholder={pending ? 'Add a follow up…' : 'Add a follow up'}
          aria-label="对话输入"
          aria-expanded={Boolean(slash?.open)}
          onChange={(event) => {
            scheduleCanSubmit(event.target.value)
            syncComposerShape(event.target)
            schedulePersistDraft(event.target.value)
            const next = readSlashAtCursor(
              event.target.value,
              event.target.selectionStart ?? event.target.value.length,
            )
            setSlash(next)
          }}
          onClick={syncSlashFromTextarea}
          onKeyUp={syncSlashFromTextarea}
          onKeyDown={onKeyDown}
        />

        <div className="composer-pill-right">
          <div className="composer-model">
            <button
              type="button"
              className="composer-model-trigger"
              aria-haspopup="listbox"
              aria-expanded={modelOpen}
              disabled={modelBusy}
              title="选择模型"
              onClick={() => setModelOpen((open) => !open)}
            >
              <span className="composer-model-label">{modelOption.label}</span>
              <LuChevronDown className="size-3.5 opacity-70" />
            </button>
            {modelOpen ? (
              <div className="composer-model-menu" role="listbox" aria-label="模型">
                <div className="composer-model-config-head">
                  <span className="composer-model-config-title">Models</span>
                  <button
                    type="button"
                    className="composer-model-config-entry"
                    data-testid="open-model-config"
                    title="配置模型"
                    aria-label="配置模型"
                    onClick={openModelConfig}
                  >
                    <LuSettings className="size-3.5" />
                  </button>
                </div>
                {(() => {
                  const visible = allModels.filter(
                    (m) => modelProviders?.[m.endpointId] || modelProviders?.[m.provider],
                  )
                  if (!visible.length) {
                    return (
                      <div className="composer-model-empty">
                        尚未配置可用模型。点击上方「配置模型」添加官方 Key 或第三方。
                      </div>
                    )
                  }
                  // 按入口分组，官方三家优先
                  const order = ['deepseek', 'anthropic', 'openai']
                  const groups = new Map<string, typeof visible>()
                  for (const m of visible) {
                    const key = m.endpointId || m.provider
                    if (!groups.has(key)) groups.set(key, [])
                    groups.get(key)!.push(m)
                  }
                  const keys = [
                    ...order.filter((k) => groups.has(k)),
                    ...[...groups.keys()].filter((k) => !order.includes(k)),
                  ]
                  return keys.map((key) => {
                    const items = groups.get(key) ?? []
                    const title =
                      endpointLabels[key] ||
                      (key === 'deepseek'
                        ? 'DeepSeek'
                        : key === 'anthropic'
                          ? 'Claude'
                          : key === 'openai'
                            ? 'GPT'
                            : key)
                    return (
                      <div key={key} className="composer-model-group">
                        <div className="composer-model-group-label">{title}</div>
                        {items.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            role="option"
                            aria-selected={option.id === modelOption.id}
                            className={`composer-model-item${option.id === modelOption.id ? ' is-active' : ''}`}
                            onClick={() => void selectModel(option)}
                          >
                            <span className="composer-model-item-label">{option.label}</span>
                            {option.note ? (
                              <span className="composer-model-item-note">{option.note}</span>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    )
                  })
                })()}
              </div>
            ) : null}
          </div>

          {pending ? (
            <button
              type="button"
              className="composer-stop"
              title="停止"
              aria-label="停止生成"
              onClick={() => void sessionView.cancel()}
            >
              <span className="composer-stop-square" aria-hidden />
            </button>
          ) : null}
          <button
            type="submit"
            className="composer-send"
            disabled={!canSubmit}
            aria-label={pending ? 'Queue' : 'Send'}
            title={pending ? (inbox.some((item) => item.kind === 'wake') ? '注入排队' : '加入排队') : '发送'}
          >
            <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden>
              <path d="M3.4 20.6 21 12 3.4 3.4 3 10.3 15 12 3 13.7z" />
            </svg>
          </button>
        </div>
      </div>
    </form>
    <ModelConfigDialog open={configOpen} onClose={() => setConfigOpen(false)} />
    </div>
  )
})
