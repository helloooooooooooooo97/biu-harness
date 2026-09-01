import { useEffect, useRef, type MouseEvent } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import type { Editor } from '@tiptap/core'
import type { FsContentProps } from '@biu/type-file-system/ui'
import { pageEditorExtensions } from './kit.ts'

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

  const flush = (editor: Editor) => {
    const next = editor.getMarkdown()
    if (next === saved.current) return
    saved.current = next
    onChange?.(next)
  }

  const editor = useEditor(
    {
      immediatelyRender: false,
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
      },
      onUpdate: ({ editor: current }) => {
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => flush(current), 400)
      },
      onBlur: ({ editor: current }) => {
        if (timer.current) clearTimeout(timer.current)
        flush(current)
      },
    },
    [record.id],
  )

  useEffect(() => {
    const incoming = asMarkdown(value)
    if (!editor || editor.isDestroyed) {
      saved.current = incoming
      return
    }
    if (incoming === saved.current) return
    saved.current = incoming
    editor.commands.setContent(incoming, { contentType: 'markdown', emitUpdate: false })
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

  if (!editor) return <div className="page-editor" data-testid="page-editor-pending" />

  return (
    <div className="page-editor">
      <EditorContent editor={editor} />
      {writable !== false ? <Bubble editor={editor} /> : null}
    </div>
  )
}
