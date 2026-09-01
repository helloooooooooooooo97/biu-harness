import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { PluginKey } from '@tiptap/pm/state'
import { PageBlockView } from './page-block-view.tsx'
import { getPageEditor } from './service.ts'

const metaKey = new PluginKey('page-block-meta')

function parseData(raw: string | null) {
  if (!raw) return {}
  try {
    return JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>
  } catch {
    try {
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      return {}
    }
  }
}

export const pageBlock = Node.create({
  name: 'pageBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      kind: { default: 'card' },
      data: { default: {}, rendered: false },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-page-block]',
        getAttrs: (el) => {
          if (!(el instanceof HTMLElement)) return false
          return {
            kind: el.getAttribute('data-page-block') || 'card',
            data: parseData(el.getAttribute('data-page-block-data')),
          }
        },
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-page-block': String(node.attrs.kind ?? 'card'),
        'data-page-block-data': encodeURIComponent(JSON.stringify(node.attrs.data ?? {})),
      }),
    ]
  },

  parseMarkdown: (token, helpers) => {
    const kind = String(token.attributes?.kind ?? 'card')
    let data: Record<string, unknown> = {}
    const raw = String(token.content ?? '').trim()
    if (raw) {
      try {
        data = JSON.parse(raw) as Record<string, unknown>
      } catch {
        data = {}
      }
    }
    return helpers.createNode('pageBlock', { kind, data })
  },

  renderMarkdown: (node) => {
    const kind = String(node.attrs?.kind ?? 'card')
    const body = JSON.stringify(node.attrs?.data ?? {}, null, 2)
    return `:::pageBlock {kind=${kind}}\n${body}\n:::`
  },

  markdownTokenizer: {
    name: 'pageBlock',
    level: 'block',
    start(src) {
      return src.match(/^:::pageBlock/m)?.index ?? -1
    },
    tokenize(src) {
      const match = src.match(/^:::pageBlock(?:\s+\{([^}]*)\})?\s*\n([\s\S]*?)\n:::/)
      if (!match) return undefined
      const kind = match[1]?.match(/kind=["']?([a-z0-9-]+)/i)?.[1] ?? 'card'
      return {
        type: 'pageBlock',
        raw: match[0],
        attributes: { kind },
        content: match[2]?.trim() ?? '',
      }
    },
  },

  addStorage() {
    return { stop: undefined as undefined | (() => void) }
  },

  addNodeView() {
    return ReactNodeViewRenderer(PageBlockView, {
      className: 'page-block',
      stopEvent: ({ event }) => {
        const target = event.target as HTMLElement | null
        return Boolean(
          target?.closest('textarea, input, select, button, canvas, .excalidraw, [data-page-block-capture]'),
        )
      },
    })
  },

  onCreate() {
    const editor = this.editor
    const stop = getPageEditor()?.subscribe(() => {
      if (editor.isDestroyed) return
      editor.view.dispatch(editor.state.tr.setMeta(metaKey, true))
    })
    this.storage.stop = stop
  },

  onDestroy() {
    this.storage.stop?.()
  },
})
