import { memo, useDeferredValue } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const REMARK_PLUGINS = [remarkGfm]

/**
 * 对话气泡内的 Markdown（GFM）。
 * 流式用纯文本；结束后用 useDeferredValue 推迟 remark 解析，
 * 避免一次长任务占死主线程（侧栏点击/hover 跟着卡）。
 */
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
  const deferredText = useDeferredValue(text)
  // 紧急更新（切会话 / 流式结束）时先继续显示纯文本，等过渡帧再跑 remark
  const pendingParse = !streaming && deferredText !== text

  if (!text) return null

  if (streaming || pendingParse) {
    return (
      <div className={`chat-md chat-md-stream ${className}`.trim()}>
        <pre className="chat-md-stream-pre">{text}</pre>
      </div>
    )
  }

  return (
    <div className={`chat-md ${className}`.trim()}>
      <Markdown remarkPlugins={REMARK_PLUGINS}>{deferredText}</Markdown>
    </div>
  )
})
