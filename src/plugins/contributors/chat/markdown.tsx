import { memo, useEffect, useState } from 'react'
import { getCachedMarkdownHtml, renderMarkdownHtml } from './markdown-render.ts'

/**
 * 对话气泡内的 Markdown（GFM）。
 * 流式用纯文本；定稿后 Worker 解析 + 主线程消毒，结果进 LRU，
 * 虚表卸载再挂也不重算——滚动时主线程不再被 remark 打爆。
 */
export const MarkdownBody = memo(function MarkdownBody({
  text,
  className = '',
  streaming = false,
}: {
  text: string
  className?: string
  /** 流式中跳过解析，避免每帧全量重算 */
  streaming?: boolean
}) {
  const cached = text && !streaming ? getCachedMarkdownHtml(text) : undefined
  const [html, setHtml] = useState<string | undefined>(cached)

  useEffect(() => {
    if (!text || streaming) {
      setHtml(undefined)
      return
    }
    const hit = getCachedMarkdownHtml(text)
    if (hit != null) {
      setHtml(hit)
      return
    }
    let cancelled = false
    setHtml(undefined)
    void renderMarkdownHtml(text).then((next) => {
      if (!cancelled) setHtml(next)
    })
    return () => {
      cancelled = true
    }
  }, [text, streaming])

  if (!text) return null

  if (streaming || html == null) {
    return (
      <div className={`chat-md chat-md-stream ${className}`.trim()}>
        <pre className="chat-md-stream-pre">{text}</pre>
      </div>
    )
  }

  return (
    <div
      className={`chat-md ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
})
