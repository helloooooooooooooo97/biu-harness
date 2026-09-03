import { createPortal } from 'react-dom'
import { ChatConfig } from './config.tsx'

/**
 * 遮罩 + 直接弹出主从面板（不再外套一层标题白盒）。
 * 挂到 document.body，避免被 .chat-composer-dock（z-index:20）和右侧检查器（z-index:90）盖住。
 */
export function ModelConfigDialog(props: { open: boolean; onClose: () => void }) {
  if (!props.open) return null
  return createPortal(
    <div
      className="fixed inset-0 z-[240] flex items-center justify-center bg-(--dsw-overlay) p-4"
      data-testid="model-config-dialog"
      onClick={props.onClose}
    >
      <ChatConfig onClose={props.onClose} />
    </div>,
    document.body,
  )
}
