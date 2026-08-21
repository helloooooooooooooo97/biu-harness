import { memo } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const REMARK_PLUGINS = [remarkGfm]

/** 对话气泡内的 Markdown 渲染（GFM：表格/任务列表/删除线等）。 */
export const MarkdownBody = memo(function MarkdownBody({
  text,
  className = '',
  streaming = false,
}: {
  text: string
  className?: string
  /** 流式中跳过 remark，避免每帧全量重解析 */
  streaming?: boolean
}) {
  if (!text) return null
  if (streaming) {
    return (
      <div className={`chat-md chat-md-stream ${className}`.trim()}>
        <pre className="chat-md-stream-pre">{text}</pre>
      </div>
    )
  }
  return (
    <div className={`chat-md ${className}`.trim()}>
      <Markdown remarkPlugins={REMARK_PLUGINS}>{text}</Markdown>
    </div>
  )
})
