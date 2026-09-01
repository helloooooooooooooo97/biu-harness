import type { NodeViewProps } from '@tiptap/react'
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react'
import { getPageEditor } from './service.ts'

function HeadingContent() {
  return <NodeViewContent as="span" className="page-h-plugin-content" />
}

export function PluginHeadingView(props: NodeViewProps) {
  const level = (Number(props.node.attrs.level) || 1) as 1 | 2 | 3
  const View = getPageEditor()?.headingView(level)?.View
  if (!View) {
    const Tag = (`h${level}` as const)
    return (
      <NodeViewWrapper as={Tag} className={`page-h page-h${level}`}>
        <NodeViewContent />
      </NodeViewWrapper>
    )
  }
  return (
    <NodeViewWrapper as="div" className={`page-h-plugin page-h${level}`} data-heading-plugin={level}>
      <View Content={HeadingContent} />
    </NodeViewWrapper>
  )
}
