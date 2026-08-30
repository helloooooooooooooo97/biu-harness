import { Node, mergeAttributes } from '@tiptap/core'
import { createRoot, type Root } from 'react-dom/client'
import { PickChipLabel, chipLabel, type PickRef } from '@biu/cap-pick/web'

function refFromAttrs(attrs: Record<string, unknown>): PickRef {
  const kind = String(attrs.kind ?? '')
  const id = String(attrs.id ?? '')
  const label = String(attrs.label ?? id)
  const route = String(attrs.route ?? '')
  const action = attrs.action ? String(attrs.action) : undefined
  return { kind, id, label, route, ...(action ? { action } : {}) }
}

function PickChipView({ attrs }: { attrs: Record<string, unknown> }) {
  const pick = refFromAttrs(attrs)
  return (
    <span
      className="composer-tool-chip is-pick"
      data-testid="user-pick-chip"
      title={`${pick.kind} · ${chipLabel(pick)}`}
    >
      <PickChipLabel pick={pick} />
    </span>
  )
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
    return ({ node }) => {
      const dom = document.createElement('span')
      dom.className = 'composer-inline-chip'
      dom.setAttribute('data-pick-chip', '')
      let attrs = node.attrs as Record<string, unknown>
      let root: Root | null = createRoot(dom)
      let paintQueued = false
      const paint = () => {
        paintQueued = false
        root?.render(<PickChipView attrs={attrs} />)
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
