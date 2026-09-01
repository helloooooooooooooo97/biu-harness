import { Extension } from '@tiptap/core'
import type { Editor, Range } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion'
import { SlashList } from './slash-list.tsx'

export type SlashItem = {
  id: string
  label: string
  hint: string
  aliases: string[]
  command: (props: { editor: Editor; range: Range }) => void
}

export const SLASH_ITEMS: SlashItem[] = [
  {
    id: 'text',
    label: '文本',
    hint: '普通段落',
    aliases: ['text', 'p', 'paragraph', '正文'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleNode('paragraph', 'paragraph').run()
    },
  },
  {
    id: 'h1',
    label: '标题 1',
    hint: '大标题',
    aliases: ['h1', 'heading', 'title', '标题'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run()
    },
  },
  {
    id: 'h2',
    label: '标题 2',
    hint: '中标题',
    aliases: ['h2', 'heading', '标题'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run()
    },
  },
  {
    id: 'h3',
    label: '标题 3',
    hint: '小标题',
    aliases: ['h3', 'heading', '标题'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run()
    },
  },
  {
    id: 'bullet',
    label: '无序列表',
    hint: '项目符号',
    aliases: ['ul', 'list', 'bullet', '列表'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run()
    },
  },
  {
    id: 'ordered',
    label: '有序列表',
    hint: '数字编号',
    aliases: ['ol', 'number', 'ordered', '列表'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run()
    },
  },
  {
    id: 'quote',
    label: '引用',
    hint: '引用块',
    aliases: ['quote', 'blockquote', '引用'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleNode('paragraph', 'paragraph').toggleBlockquote().run()
    },
  },
  {
    id: 'code',
    label: '代码',
    hint: '代码块',
    aliases: ['code', 'pre', '代码'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
    },
  },
  {
    id: 'divider',
    label: '分割线',
    hint: '分隔内容',
    aliases: ['hr', 'divider', 'line', '分割'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run()
    },
  },
]

export function filterSlashItems(query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) return SLASH_ITEMS
  return SLASH_ITEMS.filter((item) => {
    const hay = [item.id, item.label, item.hint, ...item.aliases].join(' ').toLowerCase()
    return hay.includes(needle)
  })
}

function renderSlash() {
  let component: ReactRenderer<unknown, Record<string, unknown>> | null = null
  let unmount: (() => void) | undefined

  return {
    onStart(props: { editor: Editor; mount: (el: HTMLElement) => () => void } & Record<string, unknown>) {
      if (props.editor.isActive('codeBlock')) return
      component = new ReactRenderer(SlashList, {
        props,
        editor: props.editor,
      })
      unmount = props.mount(component.element)
    },
    onUpdate(props: Record<string, unknown>) {
      component?.updateProps(props)
    },
    onKeyDown(props: { event: KeyboardEvent }) {
      if (props.event.key === 'Escape') {
        unmount?.()
        return true
      }
      const ref = component?.ref as { onKeyDown?: (props: { event: KeyboardEvent }) => boolean } | null
      return ref?.onKeyDown?.(props) ?? false
    },
    onExit() {
      unmount?.()
      unmount = undefined
      component?.destroy()
      component = null
    },
  }
}

export const slashCommand = Extension.create({
  name: 'slash-command',
  addOptions() {
    return {
      suggestion: {
        char: '/',
        allow: ({ editor }) => !editor.isActive('codeBlock'),
        items: ({ query }) => filterSlashItems(query),
        command: ({ editor, range, props }) => {
          props.command({ editor, range })
        },
        render: renderSlash,
      } satisfies Partial<SuggestionOptions<SlashItem, SlashItem>>,
    }
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ]
  },
})
