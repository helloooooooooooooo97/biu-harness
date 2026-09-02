import { Node, mergeAttributes } from '@tiptap/core'
import { createRoot, type Root } from 'react-dom/client'
import { PickChip, type PickRef } from '@biu/cap-pick/web'

function refFromAttrs(attrs: Record<string, unknown>): PickRef {
  const kind = String(attrs.kind ?? '')
  const id = String(attrs.id ?? '')
  const label = String(attrs.label ?? id)
  const route = String(attrs.route ?? '')
  const action = attrs.action ? String(attrs.action) : undefined
  return { kind, id, label, route, ...(action ? { action } : {}) }
}

function PickChipView({ attrs, onRemove }: { attrs: Record<string, unknown>; onRemove?: () => void }) {
  return <PickChip pick={refFromAttrs(attrs)} onRemove={onRemove} />
}

export const PickChipNode = Node.create({
  name: 'pickChip',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      kind: { default: '' },
      id: { default: '' },
      action: { default: null },
      label: { default: '' },
      route: { default: '' },
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-pick-chip]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-pick-chip': '',
        'data-testid': 'user-pick-chip',
        class: 'composer-tool-chip is-pick',
      }),
    ]
  },
  addNodeView() {
    return ({ editor, getPos, node }) => {
      const dom = document.createElement('span')
      dom.className = 'composer-inline-chip'
      dom.setAttribute('data-pick-chip', '')
      let attrs = node.attrs as Record<string, unknown>
      let root: Root | null = createRoot(dom)
      let paintQueued = false
      const remove = () => {
        const pos = typeof getPos === 'function' ? getPos() : undefined
        if (typeof pos !== 'number') return
        const size = editor.state.doc.nodeAt(pos)?.nodeSize ?? 1
        editor.chain().focus().deleteRange({ from: pos, to: pos + size }).run()
      }
      const paint = () => {
        paintQueued = false
        root?.render(<PickChipView attrs={attrs} onRemove={remove} />)
      }
      const schedulePaint = () => {
        if (paintQueued || !root) return
        paintQueued = true
        queueMicrotask(paint)
      }
      schedulePaint()
      return {
        dom,
        update(updated) {
          if (updated.type.name !== 'pickChip') return false
          attrs = updated.attrs as Record<string, unknown>
          schedulePaint()
          return true
        },
        destroy() {
          const current = root
          root = null
          queueMicrotask(() => current?.unmount())
        },
      }
    }
  },
})
