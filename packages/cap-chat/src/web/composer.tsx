import { memo, useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { ArrowUpIcon, ChevronDownIcon, PlusIcon, Cog6ToothIcon } from '@heroicons/react/16/solid'
import { useLocation, useNavigate } from 'react-router-dom'
import { EditorContent, useEditor } from '@tiptap/react'
import Placeholder from '@tiptap/extension-placeholder'
import type { SlotProps } from '@biu/web-slots'
import { bindSessionView, type SessionViewService } from '@biu/web-session-view'
import { pickKey, usePickState, type PickService } from '@biu/cap-pick/web'
import { composerDocExtensions } from './composer-kit.ts'
import {
  collectPickKeys,
  deletePlainRange,
  editorCaretPlain,
  insertPickChips,
  jsonFromDraft,
  serializeComposer,
} from './composer-tiptap.ts'
import { ModelConfigDialog } from './model-config-dialog.tsx'
import { ImageThumbs } from './image-thumbs.tsx'
import { collectClipboardImages, collectImageFiles } from './clipboard-images.ts'
import { revealOverlayThread } from '@biu/web-app-shell/chat-overlay'
import { shouldNavigateToSession } from './composer-nav.ts'

/** 按键不驱动受控 value；仅防抖更新发送按钮可用态，避免每个字符打穿 React 渲染。 */
const INPUT_DEBOUNCE_MS = 120

/** 胶囊行：左右 padding 10+10、两段 gap 8、与 CSS `.composer-pill-row` 一致。 */
const COMPACT_ROW_PAD_X = 20
const COMPACT_ROW_GAP_X = 16
const COMPOSER_LINE_PX = 28

/** 用「按钮还在同一行时」的编辑器宽度测是否折行，避免变方后变宽又缩回导致闪跳。 */
function editorWrapsInCompactRow(form: HTMLElement, editorDom: HTMLElement) {
  const plus = form.querySelector('.composer-plus') as HTMLElement | null
  const right = form.querySelector('.composer-pill-right') as HTMLElement | null
  const compactW =
    form.clientWidth -
    COMPACT_ROW_PAD_X -
    COMPACT_ROW_GAP_X -
    (plus?.offsetWidth ?? 28) -
    (right?.offsetWidth ?? 80)
  if (compactW <= 0) return false
  const probe = editorDom.cloneNode(true) as HTMLElement
  probe.removeAttribute('contenteditable')
  probe.style.cssText = [
    'position:absolute',
    'left:-9999px',
    'top:0',
    `width:${compactW}px`,
    'height:auto',
    'max-height:none',
    'overflow:visible',
    `line-height:${COMPOSER_LINE_PX}px`,
    'word-break:break-word',
  ].join(';')
  document.body.append(probe)
  const wraps = probe.scrollHeight > COMPOSER_LINE_PX + 4
  probe.remove()
  return wraps
}

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

const MAX_PENDING_IMAGES = 6

type PendingImage = { id: string; name: string; mime: string; previewUrl: string; file: File }

function readFileDataUrl(file: File): Promise<{ name: string; mime: string; url: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read image failed'))
    reader.onload = () => {
      resolve({
        name: file.name || 'image.png',
        mime: file.type || 'image/png',
        url: String(reader.result ?? ''),
      })
    }
    reader.readAsDataURL(file)
  })
}
type ChatProvider = 'deepseek' | 'openai' | 'anthropic'

type ModelOption = {
  id: string
  label: string
  provider: ChatProvider
  endpointId: string
  model: string
  note?: string
}

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
  const formRef = useRef<HTMLFormElement>(null)
  const pickKeysRef = useRef(new Set<string>())
  const pendingRef = useRef(false)
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
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
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

  pendingRef.current = pending

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

  function scheduleCanSubmit(
    value: string,
    tools: string[] = picked,
    picks = pickRefs.length,
    imageCount = pendingImages.length,
  ) {
    const next = Boolean(value.trim()) || tools.length > 0 || picks > 0 || imageCount > 0
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

  function schedulePersistDraft(text: string) {
    if (!sessionId) return
    if (draftTimerRef.current != null) clearTimeout(draftTimerRef.current)
    draftTimerRef.current = setTimeout(() => {
      draftTimerRef.current = null
      writeDraft(sessionId, text)
    }, DRAFT_DEBOUNCE_MS)
  }

  function flushDraftTimer() {
    if (draftTimerRef.current != null) {
      clearTimeout(draftTimerRef.current)
      draftTimerRef.current = null
    }
  }

  const addImageFiles = useCallback((files: File[]) => {
    const next = collectImageFiles(files)
    if (!next.length) return
    setPendingImages((prev) => {
      const room = MAX_PENDING_IMAGES - prev.length
      const take = next.slice(0, Math.max(0, room)).map((file) => ({
        id: `${Date.now()}-${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name || 'image.png',
        mime: file.type || 'image/png',
        previewUrl: URL.createObjectURL(file),
        file,
      }))
      return take.length ? [...prev, ...take] : prev
    })
  }, [])

  const live = useRef({
    slash,
    filtered,
    pick,
    pickRefs,
    pendingImages,
    picked,
    catalog,
  })
  live.current = { slash, filtered, pick, pickRefs, pendingImages, picked, catalog }
  const pickToolRef = useRef<(name: string) => void>(() => {})
  const activeIndexRef = useRef(0)
  activeIndexRef.current = activeIndex

  const editor = useEditor({
    immediatelyRender: true,
    extensions: [
      ...composerDocExtensions(),
      Placeholder.configure({
        placeholder: () => (pendingRef.current ? 'Add a follow up…' : 'Add a follow up'),
      }),
    ],
    editorProps: {
      attributes: {
        class: 'composer-tiptap',
        role: 'textbox',
        'aria-label': '对话输入',
      },
      handlePaste(_view, event) {
        const images = collectClipboardImages(event.clipboardData)
        if (!images.length) return false
        event.preventDefault()
        addImageFiles(images)
        return true
      },
      handleKeyDown(_view, event) {
        const menu = live.current.slash
        const list = live.current.filtered
        if (menu?.open && list.length) {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setActiveIndex((i) => (i + 1) % list.length)
            return true
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActiveIndex((i) => (i - 1 + list.length) % list.length)
            return true
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            setSlash(null)
            return true
          }
          if (event.key === 'Tab' || (event.key === 'Enter' && !event.shiftKey)) {
            if (event.isComposing) return false
            event.preventDefault()
            const item = list[activeIndexRef.current] ?? list[0]
            if (item) pickToolRef.current(item.name)
            return true
          }
        }
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
          event.preventDefault()
          formRef.current?.requestSubmit()
          return true
        }
        if (
          (event.key === 'Backspace' || event.key === 'Delete') &&
          live.current.pendingImages.length
        ) {
          const doc = _view.state.doc
          const plain = doc.textBetween(0, doc.content.size, '\n', '')
          let chips = false
          doc.descendants((node) => {
            if (node.type.name === 'pickChip') chips = true
          })
          if (!plain.trim() && !chips) {
            event.preventDefault()
            setPendingImages((prev) => {
              const last = prev[prev.length - 1]
              if (last) URL.revokeObjectURL(last.previewUrl)
              return prev.slice(0, -1)
            })
            return true
          }
        }
        return false
      },
    },
    onUpdate: ({ editor: ed }) => {
      const packed = serializeComposer(ed)
      scheduleCanSubmit(packed.plain, live.current.picked, packed.refs.length, live.current.pendingImages.length)
      const el = ed.view.dom
      const form = formRef.current
      const wraps = form ? editorWrapsInCompactRow(form, el) : el.scrollHeight > COMPOSER_LINE_PX + 4
      setExpanded(
        wraps ||
          packed.plain.includes('\n') ||
          packed.refs.length > 0 ||
          live.current.picked.length > 0 ||
          live.current.pendingImages.length > 0,
      )
      schedulePersistDraft(packed.text)
      const caret = editorCaretPlain(ed)
      setSlash(readSlashAtCursor(caret.value, caret.cursor))
      const liveKeys = collectPickKeys(ed)
      for (const ref of live.current.pick?.refs ?? []) {
        const key = pickKey(ref)
        if (!liveKeys.has(key)) live.current.pick?.remove(key)
      }
      pickKeysRef.current = liveKeys
    },
  })

  useEffect(() => {
    const onFocus = () => {
      editor?.commands.focus('end')
    }
    window.addEventListener('biu:composer-focus', onFocus)
    return () => window.removeEventListener('biu:composer-focus', onFocus)
  }, [editor])

  useEffect(
    () => () => {
      if (debounceRef.current != null) clearTimeout(debounceRef.current)
      if (draftTimerRef.current != null) clearTimeout(draftTimerRef.current)
    },
    [],
  )

  useEffect(() => {
    if (!editor || !sessionId) return
    const draft = readDraftMap()[sessionId]
    pick?.clear()
    pickKeysRef.current = new Set()
    if (typeof draft === 'string' && draft) {
      editor.commands.setContent(jsonFromDraft(draft))
      const { refs } = serializeComposer(editor)
      if (refs.length) pick?.addMany(refs)
      pickKeysRef.current = collectPickKeys(editor)
    } else {
      editor.commands.clearContent()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, editor])

  useEffect(() => {
    if (!editor) return
    const missing = pickRefs.filter((ref) => !pickKeysRef.current.has(pickKey(ref)))
    const nextKeys = new Set(pickRefs.map((item) => pickKey(item)))
    queueMicrotask(() => {
      if (editor.isDestroyed) return
      insertPickChips(editor, missing)
      pickKeysRef.current = nextKeys
      const packed = serializeComposer(editor)
      scheduleCanSubmit(packed.plain, picked, packed.refs.length, pendingImages.length)
    })
  }, [pickRefs, editor, picked.length, pendingImages.length])

  function clearInput() {
    if (debounceRef.current != null) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    flushDraftTimer()
    editor?.commands.clearContent(true)
    canSubmitRef.current = false
    setCanSubmit(false)
    setSlash(null)
    setPicked([])
    setPendingImages((prev) => {
      for (const item of prev) URL.revokeObjectURL(item.previewUrl)
      return []
    })
    pickKeysRef.current = new Set()
    setExpanded(false)
  }

  function onDrop(event: DragEvent<HTMLFormElement>) {
    const images = collectImageFiles(event.dataTransfer?.files)
    if (!images.length) return
    event.preventDefault()
    addImageFiles(images)
  }

  const openSlashMenu = useCallback(() => {
    if (!editor) return
    const { value, cursor } = editorCaretPlain(editor)
    const needsSpace = cursor > 0 && !/\s$/.test(value.slice(0, cursor))
    editor.chain().focus().insertContent(`${needsSpace ? ' ' : ''}/`).run()
    const caret = editorCaretPlain(editor)
    setSlash(readSlashAtCursor(caret.value, caret.cursor))
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
  }, [catalog.length, editor])

  const pickTool = useCallback(
    (name: string, slashState: SlashState | null = slash) => {
      setPicked((prev) => {
        const nextTools = prev.includes(name) ? prev : [...prev, name]
        if (editor && slashState) deletePlainRange(editor, slashState.start, slashState.end)
        const packed = serializeComposer(editor)
        scheduleCanSubmit(packed.plain, nextTools, packed.refs.length)
        return nextTools
      })
      setSlash(null)
    },
    [slash, editor],
  )
  pickToolRef.current = pickTool

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
    const packedEditor = serializeComposer(editor)
    const content = packedEditor.plain.trim()
    // 空回车 + 队列有 wake：abort 当前回合并立刻 claim
    if (!content && !picked.length && !packedEditor.refs.length && !pendingImages.length) {
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
    const fallback = tools.length ? `请使用工具：${tools.join(', ')}` : pendingImages.length ? '（图片）' : ''
    const text = packedEditor.text || fallback
    const packed = await Promise.all(pendingImages.map((item) => readFileDataUrl(item.file)))
    clearInput()
    pick?.clear()
    revealOverlayThread()
    try {
      await sessionView.send(
        text,
        'wake',
        tools,
        packed.filter((item) => item.url.startsWith('data:image/')),
      )
      revealOverlayThread()
      const id = sessionView.get().sessionId
      if (id) {
        clearDraft(id)
        flushDraftTimer()
      }
      if (id && shouldNavigateToSession(location.pathname, id)) navigate(`/s/${id}`)
    } catch {
      /* error 已写入 sessionView */
    }
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
        ref={formRef}
        className={`composer-pill${expanded ? ' is-expanded' : ''}${pickRefs.length || picked.length || pendingImages.length ? ' has-chips' : ''}`}
        onSubmit={onSubmit}
        onDragOver={(event) => {
          if ([...(event.dataTransfer?.types ?? [])].includes('Files')) event.preventDefault()
        }}
        onDrop={onDrop}
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
                  const packed = serializeComposer(editor)
                  scheduleCanSubmit(packed.plain, next, packed.refs.length)
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

      {pendingImages.length ? (
        <ImageThumbs
          images={pendingImages.map((item) => ({
            name: item.name,
            mime: item.mime,
            url: item.previewUrl,
          }))}
          onRemove={(index) => {
            setPendingImages((prev) => {
              const hit = prev[index]
              if (hit) URL.revokeObjectURL(hit.previewUrl)
              return prev.filter((_, i) => i !== index)
            })
          }}
        />
      ) : null}

      <div className="composer-pill-row">
        <button
          type="button"
          className="composer-plus"
          title="添加工具 (/)"
          aria-label="添加工具"
          onClick={openSlashMenu}
        >
          <PlusIcon className="size-4" />
        </button>

        <EditorContent editor={editor} className="composer-editor" />

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
              <ChevronDownIcon className="size-3.5 opacity-70" />
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
                    <Cog6ToothIcon className="size-3.5" />
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
            <ArrowUpIcon className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>
    </form>
    <ModelConfigDialog open={configOpen} onClose={() => setConfigOpen(false)} />
    </div>
  )
})
