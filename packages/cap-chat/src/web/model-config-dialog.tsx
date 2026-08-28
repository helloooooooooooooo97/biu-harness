import { ChatConfig } from './config.tsx'

/**
 * 遮罩 + 直接弹出主从面板（不再外套一层标题白盒）。
 */
export function ModelConfigDialog(props: { open: boolean; onClose: () => void }) {
  if (!props.open) return null
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-(--dsw-overlay) p-4"
      data-testid="model-config-dialog"
      onClick={props.onClose}
    >
      <ChatConfig onClose={props.onClose} />
    </div>
  )
}
