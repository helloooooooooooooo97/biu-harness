import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import { PickChipLabel, chipLabel } from '@biu/cap-pick/web'

function PickChipView({ node }: { node: { attrs: Record<string, string | null> } }) {
  const kind = String(node.attrs.kind ?? '')
  const id = String(node.attrs.id ?? '')
  const label = String(node.attrs.label ?? id)
  const route = String(node.attrs.route ?? '')
  const action = node.attrs.action ? String(node.attrs.action) : undefined
  return (
    <NodeViewWrapper as="span" className="composer-inline-chip">
      <span
        className="composer-tool-chip is-pick"
        data-testid="user-pick-chip"
        title={`${kind} · ${chipLabel({ kind, id, label, route, action })}`}
      >
        <PickChipLabel pick={{ kind, id, label, route, ...(action ? { action } : {}) }} />
      </span>
    </NodeViewWrapper>
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
    return ReactNodeViewRenderer(PickChipView, { as: 'span' })
  },
})
