import { useEffect, useState } from 'react'
import type { SlotProps } from '@biu/web-slots'

/** 未配置 API Key 时在对话区提示，避免用户以为模型「没响应」。 */
export function ChatConfigBanner(_props: SlotProps) {
  const [configured, setConfigured] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/chat/config')
        const data = (await res.json()) as { configured?: boolean }
        if (!cancelled) setConfigured(Boolean(data.configured))
      } catch {
        if (!cancelled) setConfigured(null)
      }
    }
    void load()
    const timer = window.setInterval(() => void load(), 5000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  if (configured !== false) return null

  return (
    <div
      className="w-full border border-[var(--dsw-border)] bg-[var(--dsw-input)] px-4 py-2 text-xs text-[var(--dsw-label-2)]"
      style={{ borderRadius: 'var(--dsw-radius-bubble)' }}
      role="status"
    >
      尚未配置 API Key：消息会本地回声，不会调用模型。打开 Settings → Assistant，填写 Key 后点「Save Assistant」。
    </div>
  )
}
