import { memo, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { LuChevronDown, LuPlus } from 'react-icons/lu'
import { useLocation, useNavigate } from 'react-router-dom'
import type { SlotProps } from '../../registry/slots.ts'
import { bindSessionView, type SessionViewService } from '../../infrastructure/session-view.ts'

/** 按键不驱动受控 value；仅防抖更新发送按钮可用态，避免每个字符打穿 React 渲染。 */
const INPUT_DEBOUNCE_MS = 120

type ToolCatalogItem = { name: string; description: string }
type ChatProvider = 'deepseek' | 'openai'

type ModelOption = {
  id: string
  label: string
  provider: ChatProvider
  model: string
}

const MODEL_OPTIONS: ModelOption[] = [
  { id: 'deepseek-chat', label: 'DeepSeek Chat', provider: 'deepseek', model: 'deepseek-chat' },
  { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner', provider: 'deepseek', model: 'deepseek-reasoner' },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini', provider: 'openai', model: 'gpt-4o-mini' },
  { id: 'gpt-4o', label: 'GPT-4o', provider: 'openai', model: 'gpt-4o' },
]

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

function matchModelOption(provider: string, model: string): ModelOption {
  return (
    MODEL_OPTIONS.find((item) => item.provider === provider && item.model === model) ??
    MODEL_OPTIONS.find((item) => item.model === model) ?? {
      id: `${provider}:${model}`,
      label: model,
      provider: provider === 'openai' ? 'openai' : 'deepseek',
      model,
    }
  )
}

export const ChatComposer = memo(function ChatComposer(props: SlotProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const canSubmitRef = useRef(false)
  const [canSubmit, setCanSubmit] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [catalog, setCatalog] = useState<ToolCatalogItem[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [slash, setSlash] = useState<SlashState | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [modelOpen, setModelOpen] = useState(false)
  const [modelOption, setModelOption] = useState<ModelOption>(MODEL_OPTIONS[0]!)
  const [modelBusy, setModelBusy] = useState(false)
  const useSessionView = props.useSessionView as ReturnType<typeof bindSessionView>
  const pending = useSessionView((state) => state.pending)
  const inbox = useSessionView((state) => state.inbox)
  const sessionView = props.sessionView as SessionViewService
  const navigate = useNavigate()
  const location = useLocation()

  function syncComposerShape(
    el: HTMLTextAreaElement | null = textareaRef.current,
    toolsCount = picked.length,
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
    },
    [],
  )

  useEffect(() => {
    let cancelled = false
    void fetch('/api/chat/config')
      .then((res) => res.json())
      .then((data: { toolCatalog?: ToolCatalogItem[]; provider?: string; model?: string }) => {
        if (cancelled) return
        const items = Array.isArray(data.toolCatalog) ? data.toolCatalog : []
        setCatalog(items.filter((item) => item?.name))
        if (data.provider && data.model) setModelOption(matchModelOption(data.provider, data.model))
      })
      .catch(() => {
        /* ignore */
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!modelOpen) return
    const onPointer = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('.composer-model')) return
      setModelOpen(false)
    }
    window.addEventListener('mousedown', onPointer)
    return () => window.removeEventListener('mousedown', onPointer)
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

  function scheduleCanSubmit(value: string, tools: string[] = picked) {
    const next = Boolean(value.trim()) || tools.length > 0
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

  function clearInput() {
    if (debounceRef.current != null) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
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
        body: JSON.stringify({ provider: option.provider, model: option.model }),
      })
      if (!res.ok) return
      const data = (await res.json()) as { provider?: string; model?: string }
      if (data.provider && data.model) setModelOption(matchModelOption(data.provider, data.model))
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
    if (!content && !picked.length) {
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
    const text = content || (tools.length ? `请使用工具：${tools.join(', ')}` : '')
    clearInput()
    try {
      await sessionView.send(text, 'wake', tools)
      const id = sessionView.get().sessionId
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
    <div className="composer-stack">
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

      <form className={`composer-pill${expanded ? ' is-expanded' : ''}`} onSubmit={onSubmit}>
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
                {MODEL_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={option.id === modelOption.id}
                    className={`composer-model-item${option.id === modelOption.id ? ' is-active' : ''}`}
                    onClick={() => void selectModel(option)}
                  >
                    {option.label}
                  </button>
                ))}
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
    </div>
  )
})
