import type { SlotProps } from '../../registry/slots.ts'
import { useChatStore } from './store.ts'

export function ChatThread(_props: SlotProps) {
  const list = useChatStore((state) => state.messages)
  const busy = useChatStore((state) => state.pending)
  return (
    <div className="flex flex-col gap-4">
      {list.map((item, index) => (
        <div
          key={`${item.role}-${index}`}
          className={
            item.role === 'user'
              ? 'ml-10 self-end rounded-2xl bg-[#4d6bfe] px-4 py-3 text-sm text-white'
              : 'mr-10 self-start rounded-2xl bg-[#2d2e30] px-4 py-3 text-sm leading-6'
          }
        >
          {item.content}
        </div>
      ))}
      {busy ? <div className="mr-10 self-start text-sm text-[#9aa0a6]">思考中…</div> : null}
    </div>
  )
}
