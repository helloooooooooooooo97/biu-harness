import { LuX } from 'react-icons/lu'
import { ChatConfig } from './config.tsx'

/** 从 Composer 模型选框唤起的模型配置弹层。 */
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
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--dsw-border)] px-4 py-3">
          <div>
            <h2 className="text-[14px] font-semibold text-[var(--dsw-label)]">模型配置</h2>
            <p className="mt-0.5 text-[11px] text-[var(--dsw-label-3)]">
              官方 Key / 第三方 URL · 选模型 · 测试连接
            </p>
          </div>
          <button
            type="button"
            className="grid size-8 place-items-center rounded-[8px] text-[var(--dsw-label-3)] hover:bg-[var(--dsw-hover)] hover:text-[var(--dsw-label)]"
            aria-label="关闭"
            onClick={props.onClose}
          >
            <LuX className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden p-3">
          <ChatConfig />
        </div>
      </div>
    </div>
  )
}
