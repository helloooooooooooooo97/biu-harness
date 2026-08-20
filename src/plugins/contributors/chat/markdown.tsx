import { memo } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/** 对话气泡内的 Markdown 渲染（GFM：表格/任务列表/删除线等）。 */
export const MarkdownBody = memo(function MarkdownBody({
  text,
  className = '',
}: {
  text: string
  className?: string
}) {
  if (!text) return null
  return (
    <div className={`chat-md ${className}`.trim()}>
      <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
    </div>
  )
})
