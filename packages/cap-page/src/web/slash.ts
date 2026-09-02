import { Extension } from '@tiptap/core'
import type { Editor, Range } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion'
import { SlashList } from './slash-list.tsx'
import { placeSlashInWindow } from './slash-place.ts'
import { getPageEditor, type SlashInsert } from './service.ts'

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

function runInsert(editor: Editor, range: Range, insert: SlashInsert) {
  const chain = editor.chain().focus().deleteRange(range)
  if (insert === 'paragraph') return chain.toggleNode('paragraph', 'paragraph').run()
  if (insert === 'heading1') return chain.setNode('heading', { level: 1 }).run()
  if (insert === 'heading2') return chain.setNode('heading', { level: 2 }).run()
  if (insert === 'heading3') return chain.setNode('heading', { level: 3 }).run()
  if (insert === 'bullet') return chain.toggleBulletList().run()
  if (insert === 'ordered') return chain.toggleOrderedList().run()
  if (insert === 'quote') return chain.toggleNode('paragraph', 'paragraph').toggleBlockquote().run()
  if (insert === 'code') return chain.toggleCodeBlock().run()
  return chain.setHorizontalRule().run()
}

export function slashCatalog(): SlashItem[] {
  const extras = getPageEditor()?.slashCommands() ?? []
  const blocks = getPageEditor()?.blocks() ?? []
  if (!extras.length && !blocks.length) return SLASH_ITEMS
  const map = new Map(SLASH_ITEMS.map((item) => [item.id, item]))
  for (const extra of extras) {
    const prev = map.get(extra.id)
    map.set(extra.id, {
      id: extra.id,
      label: extra.label ?? prev?.label ?? extra.id,
      hint: extra.hint ?? prev?.hint ?? '',
      aliases: extra.aliases ?? prev?.aliases ?? [],
      command: extra.insert
        ? ({ editor, range }) => runInsert(editor, range, extra.insert!)
        : (prev?.command ?? (({ editor, range }) => editor.chain().focus().deleteRange(range).run())),
    })
  }
  for (const block of blocks) {
    map.set(block.kind, {
      id: block.kind,
      label: block.label,
      hint: block.hint ?? '自定义块',
      aliases: block.aliases ?? [],
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent({
            type: 'pageBlock',
            attrs: {
              kind: block.kind,
              data: typeof block.defaults === 'function' ? block.defaults() : { ...(block.defaults ?? {}) },
            },
          })
          .run()
      },
    })
  }
  return [...map.values()]
}

export function filterSlashItems(query: string) {
  const items = slashCatalog()
  const needle = query.trim().toLowerCase()
  if (!needle) return items
  return items.filter((item) => {
    const hay = [item.id, item.label, item.hint, ...item.aliases].join(' ').toLowerCase()
    return hay.includes(needle)
  })
}

function renderSlash() {
  let component: ReactRenderer<unknown, Record<string, unknown>> | null = null
  let unmount: (() => void) | undefined
  let cancelled = false
  let pending: ({ editor: Editor; mount: (el: HTMLElement) => () => void } & Record<string, unknown>) | null = null

  return {
    onStart(props: { editor: Editor; mount: (el: HTMLElement) => () => void } & Record<string, unknown>) {
      cancelled = false
      pending = props
      if (props.editor.isActive('codeBlock')) return
      // TipTap 文档：事务是同步的，ReactRenderer 的 flushSync 不能落在 React effect 里。
      queueMicrotask(() => {
        if (cancelled || !pending) return
        component = new ReactRenderer(SlashList, {
          props: pending,
          editor: pending.editor,
        })
        const el = component.element as HTMLElement
        el.style.zIndex = '10000'
        el.style.maxHeight = `${Math.min(420, Math.max(120, window.innerHeight - 16))}px`
        unmount = pending.mount(el)
      })
    },
    onUpdate(props: Record<string, unknown>) {
      pending = { ...(pending ?? {}), ...props } as typeof pending
      component?.updateProps(props)
    },
    onKeyDown(props: { event: KeyboardEvent }) {
      if (props.event.key === 'Escape') {
        cancelled = true
        unmount?.()
        return true
      }
      const ref = component?.ref as { onKeyDown?: (props: { event: KeyboardEvent }) => boolean } | null
      return ref?.onKeyDown?.(props) ?? false
    },
    onExit() {
      cancelled = true
      pending = null
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
        placement: 'bottom-start',
        flip: false,
        floatingUi: {
          strategy: 'fixed',
          middleware: [
            {
              name: 'keepInWindow',
              fn({ rects, elements }) {
                const placed = placeSlashInWindow({
                  caret: {
                    top: rects.reference.y,
                    bottom: rects.reference.y + rects.reference.height,
                    left: rects.reference.x,
                  },
                  menu: { width: rects.floating.width, height: rects.floating.height },
                  viewport: { width: window.innerWidth, height: window.innerHeight },
                })
                elements.floating.style.maxHeight = `${placed.maxHeight}px`
                return { x: placed.left, y: placed.top }
              },
            },
          ],
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
