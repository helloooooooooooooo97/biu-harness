import { memo, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { SlotProps } from '../../registry/slots.ts'
import { bindSessionView, type SessionViewService } from '../../infrastructure/session-view.ts'

/** 按键不驱动受控 value；仅防抖更新发送按钮可用态，避免每个字符打穿 React 渲染。 */
const INPUT_DEBOUNCE_MS = 120

type ToolCatalogItem = { name: string; description: string }

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

export const ChatComposer = memo(function ChatComposer(props: SlotProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const canSubmitRef = useRef(false)
  const [canSubmit, setCanSubmit] = useState(false)
  const [catalog, setCatalog] = useState<ToolCatalogItem[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [slash, setSlash] = useState<SlashState | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const useSessionView = props.useSessionView as ReturnType<typeof bindSessionView>
  const pending = useSessionView((state) => state.pending)
  const sessionView = props.sessionView as SessionViewService
  const navigate = useNavigate()
  const location = useLocation()

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
      .then((data: { toolCatalog?: ToolCatalogItem[] }) => {
        if (cancelled) return
        const items = Array.isArray(data.toolCatalog) ? data.toolCatalog : []
        setCatalog(items.filter((item) => item?.name))
      })
      .catch(() => {
        /* ignore */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    if (!slash?.open) return []
    const q = slash.query.trim().toLowerCase()
    const base = catalog.filter((item) => !picked.includes(item.name))
    if (!q) return base.slice(0, 12)
    return base.filter((item) => item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)).slice(0, 12)
  }, [catalog, picked, slash])

  useEffect(() => {
    setActiveIndex(0)
  }, [slash?.query, slash?.open, filtered.length])

  function scheduleCanSubmit(value: string, tools: string[] = picked) {
    const next = Boolean(value.trim()) || tools.length > 0
    if (debounceRef.current != null) clearTimeout(debounceRef.current)
    if (next === canSubmitRef.current) {
      // still flush quickly when already true after pick
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
    if (el) el.value = ''
    canSubmitRef.current = false
    setCanSubmit(false)
    setSlash(null)
    setPicked([])
  }

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

  const pickTool = useCallback((name: string, slashState: SlashState | null = slash) => {
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
      } else {
        scheduleCanSubmit(el?.value ?? '', nextTools)
      }
      return nextTools
    })
    setSlash(null)
  }, [slash, picked])

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
    if (!content && !picked.length) return
    const tools = [...picked]
    const text =
      content ||
      (tools.length ? `请使用工具：${tools.join(', ')}` : '')
    clearInput()
    try {
      await sessionView.send(text, pending ? 'inject' : 'wake', tools)
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
    <form
      className="composer-form relative w-full border border-[var(--dsw-border)] bg-[var(--dsw-input)]"
      style={{ borderRadius: 'var(--dsw-radius-bubble)', boxShadow: 'var(--dsw-shadow-lv2)' }}
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
                setPicked((prev) => prev.filter((item) => item !== name))
                scheduleCanSubmit(textareaRef.current?.value ?? '')
              }}
            >
              <span>/{name}</span>
              <span aria-hidden>×</span>
            </button>
          ))}
        </div>
      ) : null}

      <textarea
        ref={textareaRef}
        className="max-h-40 min-h-[52px] w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-[15px] text-[var(--dsw-label)] outline-none placeholder:text-[var(--dsw-label-3)]"
        defaultValue=""
        rows={1}
        placeholder={pending ? 'Steer while running…' : '输入 / 选择工具，或直接发消息…'}
        aria-label="对话输入"
        aria-expanded={Boolean(slash?.open)}
        aria-controls={slash?.open ? undefined : undefined}
        onChange={(event) => {
          scheduleCanSubmit(event.target.value)
          const next = readSlashAtCursor(event.target.value, event.target.selectionStart ?? event.target.value.length)
          setSlash(next)
        }}
        onClick={syncSlashFromTextarea}
        onKeyUp={syncSlashFromTextarea}
        onKeyDown={onKeyDown}
      />
      <div className="flex items-center justify-end gap-2 px-3 pb-3">
        {pending ? (
          <>
            <button
              className="rounded-full border border-[var(--dsw-border)] px-3 py-1.5 text-xs text-[var(--dsw-label-2)] hover:bg-[var(--dsw-hover)]"
              type="button"
              onClick={() => void sessionView.cancel()}
            >
              Cancel
            </button>
            <button
              className="rounded-full px-3 py-1.5 text-xs text-[var(--dsw-bg)] disabled:opacity-40"
              style={{ background: 'var(--dsw-business)' }}
              type="submit"
              disabled={!canSubmit}
            >
              Steer
            </button>
          </>
        ) : (
          <button
            className="grid size-8 place-items-center rounded-full text-[var(--dsw-bg)] disabled:opacity-40"
            style={{ background: 'var(--dsw-business)' }}
            type="submit"
            disabled={!canSubmit}
            aria-label="Send"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
              <path d="M3.4 20.6 21 12 3.4 3.4 3 10.3 15 12 3 13.7z" />
            </svg>
          </button>
        )}
      </div>
    </form>
  )
})
