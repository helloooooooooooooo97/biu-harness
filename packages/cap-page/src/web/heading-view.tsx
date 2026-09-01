import type { NodeViewProps } from '@tiptap/react'
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react'
import { getPageEditor, usePageEditorVersion, type HeadingLevel } from './service.ts'

function headingTag(level: number): 'h1' | 'h2' | 'h3' {
  if (level === 2) return 'h2'
  if (level === 3) return 'h3'
  return 'h1'
}

/** 对齐官方 Heading：可编辑内容在 h1/h2/h3 里（inline*），level 不写进 HTML。 */
export function HeadingView({ node, HTMLAttributes }: NodeViewProps) {
  usePageEditorVersion()
  const level = (Number(node.attrs.level) || 1) as HeadingLevel
  const Tag = headingTag(level)
  const heading = <NodeViewContent as={Tag} {...HTMLAttributes} />
  const View = getPageEditor()?.headingView(level)?.View
  if (!View) {
    return <NodeViewWrapper className="page-heading">{heading}</NodeViewWrapper>
  }
  return (
    <NodeViewWrapper className="page-heading" data-heading-plugin={level}>
      <View level={level}>{heading}</View>
    </NodeViewWrapper>
  )
}
