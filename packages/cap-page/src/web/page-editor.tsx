import { useEffect, useRef, type MouseEvent } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import type { Editor } from '@tiptap/core'
import { Selection } from '@tiptap/pm/state'
import type { FsContentProps } from '@biu/type-file-system/ui'
import { pageEditorExtensions } from './kit.ts'
import { FOCUS_RECORD_CONTENT, FOCUS_RECORD_TITLE, isDocStartSelection } from './title-content-nav.ts'

function asMarkdown(value: unknown) {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object' && !Array.isArray(value) && typeof (value as { body?: unknown }).body === 'string') {
    return String((value as { body: string }).body)
  }
  return String(value)
}

function Bubble({ editor }: { editor: Editor }) {
  const btn = (label: string, on: boolean, run: () => void) => (
    <button
      type="button"
      className={on ? 'is-on' : undefined}
      onMouseDown={(event: MouseEvent) => {
        event.preventDefault()
        run()
      }}
    >
      {label}
    </button>
  )

  return (
    <BubbleMenu editor={editor} className="page-bubble" aria-label="文字样式">
      {btn('B', editor.isActive('bold'), () => editor.chain().focus().toggleBold().run())}
      {btn('I', editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run())}
      {btn('S', editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run())}
      {btn('</>', editor.isActive('code'), () => editor.chain().focus().toggleCode().run())}
      {btn('H1', editor.isActive('heading', { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run())}
      {btn('H2', editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run())}
    </BubbleMenu>
  )
}

export function PageEditor({ record, value, writable, onChange }: FsContentProps) {
  const saved = useRef(asMarkdown(value))
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hydratedId = useRef<string | null>(null)

  const editor = useEditor(
    {
      immediatelyRender: false,
      shouldRerenderOnTransaction: false,
      editable: writable !== false,
      extensions: pageEditorExtensions(),
      content: asMarkdown(value),
      contentType: 'markdown',
      editorProps: {
        attributes: {
          class: 'tiptap',
          role: 'textbox',
          'aria-label': '页面正文',
          'data-testid': 'page-editor',
        },
        handleKeyDown: (view, event) => {
          if (event.key !== 'ArrowUp' || event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) return false
          if (event.isComposing) return false
          const sel = view.state.selection
          const start = Selection.atStart(view.state.doc).from
          if (!isDocStartSelection(sel.from, sel.empty, start)) return false
          event.preventDefault()
          window.dispatchEvent(new Event(FOCUS_RECORD_TITLE))
          return true
        },
      },
      onUpdate: ({ editor: current }) => {
        if (hydratedId.current !== record.id) return
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => {
          queueMicrotask(() => {
            if (current.isDestroyed) return
            const next = current.getMarkdown()
            if (next === saved.current) return
            saved.current = next
            onChange?.(next)
          })
        }, 400)
      },
      onBlur: ({ editor: current }) => {
        if (hydratedId.current !== record.id) return
        if (timer.current) clearTimeout(timer.current)
        queueMicrotask(() => {
          if (current.isDestroyed) return
          const next = current.getMarkdown()
          if (next === saved.current) return
          saved.current = next
          onChange?.(next)
        })
      },
    },
    [record.id],
  )

  useEffect(() => {
    hydratedId.current = null
  }, [record.id])

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    if (value == null) return
    if (hydratedId.current === record.id) return
    const md = asMarkdown(value)
    saved.current = md
    hydratedId.current = record.id
    editor.commands.setContent(md, { contentType: 'markdown', emitUpdate: false })
  }, [editor, record.id, value])

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    editor.setEditable(writable !== false)
  }, [editor, writable])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const onFocus = () => {
      if (editor.isDestroyed) return
      editor.commands.focus('start')
    }
    window.addEventListener(FOCUS_RECORD_CONTENT, onFocus)
    return () => window.removeEventListener(FOCUS_RECORD_CONTENT, onFocus)
  }, [editor])

  if (!editor) return <div className="page-editor" data-testid="page-editor-pending" />

  return (
    <div className="page-editor">
      <EditorContent editor={editor} />
      {writable !== false ? <Bubble editor={editor} /> : null}
    </div>
  )
}
