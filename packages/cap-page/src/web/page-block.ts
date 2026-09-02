import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { Node as PmNode } from '@tiptap/pm/model'
import { PageBlockView } from './page-block-view.tsx'
import { getPageEditor } from './service.ts'

const metaKey = new PluginKey('page-block-meta')
const uniqueFilesKey = new PluginKey('page-block-unique-files')

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

function blockFile(node: PmNode) {
  const data = node.attrs.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) return ''
  const file = (data as { file?: unknown }).file
  return typeof file === 'string' ? file : ''
}

/** 复制块时换一个 assets 文件名，内容由 View 按 cloneFrom 再拷一份。 */
export function duplicateAssetPath(file: string) {
  const raw = file.replace(/^assets\//, '')
  const dot = raw.lastIndexOf('.')
  const ext = dot >= 0 ? raw.slice(dot) : '.json'
  let stem = dot >= 0 ? raw.slice(0, dot) : raw
  stem = stem.replace(/-copy-[0-9a-f]{8}$/i, '')
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 8)
  return `assets/${stem}-copy-${id}${ext}`
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
    const data = { ...((node.attrs?.data && typeof node.attrs.data === 'object' ? node.attrs.data : {}) as Record<string, unknown>) }
    delete data.cloneFrom
    const body = JSON.stringify(data, null, 2)
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

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: uniqueFilesKey,
        appendTransaction(transactions, _old, state) {
          if (!transactions.some((item) => item.docChanged)) return null
          const seen = new Set<string>()
          const dupes: { pos: number; node: PmNode }[] = []
          state.doc.descendants((node, pos) => {
            if (node.type.name !== 'pageBlock') return
            const file = blockFile(node)
            if (!file) return
            if (!seen.has(file)) {
              seen.add(file)
              return
            }
            dupes.push({ pos, node })
          })
          if (!dupes.length) return null
          let tr = state.tr
          for (const { pos, node } of dupes.slice().sort((a, b) => b.pos - a.pos)) {
            const data = {
              ...((node.attrs.data && typeof node.attrs.data === 'object' ? node.attrs.data : {}) as Record<string, unknown>),
            }
            const from = String(data.file)
            data.file = duplicateAssetPath(from)
            data.cloneFrom = from
            tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, data })
          }
          return tr
        },
      }),
    ]
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
