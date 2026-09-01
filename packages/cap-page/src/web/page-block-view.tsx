import type { NodeViewProps } from '@tiptap/react'
import { NodeViewWrapper } from '@tiptap/react'
import { getPageEditor, usePageEditorVersion } from './service.ts'

export function PageBlockView({ node, updateAttributes, editor }: NodeViewProps) {
  usePageEditorVersion()
  const kind = String(node.attrs.kind ?? 'card')
  const data = (node.attrs.data && typeof node.attrs.data === 'object' ? node.attrs.data : {}) as Record<string, unknown>
  const spec = getPageEditor()?.block(kind)
  const update = (patch: Record<string, unknown>, opts?: { replace?: boolean }) => {
    updateAttributes({ data: opts?.replace ? patch : { ...data, ...patch } })
  }
  const View = spec?.View
  return (
    <NodeViewWrapper className="page-block" data-page-block={kind} data-testid={`page-block-${kind}`}>
      {View ? (
        <View data={data} update={update} writable={editor.isEditable} />
      ) : (
        <div className="page-block-missing">未启用「{kind}」块插件</div>
      )}
    </NodeViewWrapper>
  )
}
