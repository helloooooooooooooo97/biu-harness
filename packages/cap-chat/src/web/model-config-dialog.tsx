import { ChatConfig } from './config.tsx'

/** 从 Composer 模型选框唤起的模型配置弹层（单层壳，内容即 ChatConfig）。 */
export function ModelConfigDialog(props: { open: boolean; onClose: () => void }) {
  if (!props.open) return null
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-[var(--dsw-overlay)] p-4"
      role="dialog"
      aria-modal="true"
      aria-label="模型配置"
      data-testid="model-config-dialog"
      onClick={props.onClose}
    >
      <div
        className="flex h-[min(640px,calc(100vh-48px))] w-[min(720px,calc(100vw-32px))] flex-col overflow-hidden rounded-[16px] bg-[var(--dsw-surface)] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <ChatConfig onClose={props.onClose} />
      </div>
    </div>
  )
}
