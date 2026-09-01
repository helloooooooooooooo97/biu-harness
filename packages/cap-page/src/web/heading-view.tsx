import type { NodeViewRendererProps } from '@tiptap/core'
import type { NodeViewProps } from '@tiptap/react'
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import { getPageEditor, usePageEditorVersion, type HeadingLevel } from './service.ts'

function headingTag(level: number): 'h1' | 'h2' | 'h3' {
  if (level === 2) return 'h2'
  if (level === 3) return 'h3'
  return 'h1'
}

/**
 * ProseMirror 把 renderer 根节点当成 heading 这个 textblock。
 * 根必须是 h1/h2/h3，contentDOM 必须是 span（inline*）。
 * 中间不能再套 block div，否则方向键只能往下、不能往上。
 */
export function HeadingView({ node, HTMLAttributes }: NodeViewProps) {
  usePageEditorVersion()
  const level = (Number(node.attrs.level) || 1) as HeadingLevel
  const heading = <NodeViewContent as="span" {...HTMLAttributes} />
  const View = getPageEditor()?.headingView(level)?.View
  return (
    <NodeViewWrapper as="span" className="page-heading">
      {View ? <View level={level}>{heading}</View> : heading}
    </NodeViewWrapper>
  )
}

export function headingNodeView(props: NodeViewRendererProps) {
  const Tag = headingTag(Number(props.node.attrs.level) || 1)
  return ReactNodeViewRenderer(HeadingView, {
    as: Tag,
    contentDOMElementTag: 'span',
    className: 'page-heading',
    update: ({ oldNode, newNode, updateProps }) => {
      if (oldNode.attrs.level !== newNode.attrs.level) return false
      updateProps()
      return true
    },
  })(props)
}
