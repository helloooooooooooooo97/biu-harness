import { memo, useSyncExternalStore } from 'react'
import {
  getChatOutlineFilter,
  setChatOutlineFilter,
  subscribeChatOutline,
  type ChatOutlineFilter,
} from './chat-outline.ts'

export const ChatOutlineFilterFields = memo(function ChatOutlineFilterFields() {
  const filter = useSyncExternalStore(subscribeChatOutline, getChatOutlineFilter, (): ChatOutlineFilter => 'user')
  return (
    <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0" data-testid="chat-outline-filter">
      <legend className="mb-1 text-[11px] text-(--dsw-label-3)">消息大纲</legend>
      <label className="flex items-center gap-2 text-[12px] text-(--dsw-label-2)">
        <input
          type="radio"
          name="chat-outline-filter"
          checked={filter === 'user'}
          onChange={() => setChatOutlineFilter('user')}
        />
        只显示我发的消息
      </label>
      <label className="flex items-center gap-2 text-[12px] text-(--dsw-label-2)">
        <input
          type="radio"
          name="chat-outline-filter"
          checked={filter === 'all'}
          onChange={() => setChatOutlineFilter('all')}
        />
        显示全部消息（含机器人主动发出的）
      </label>
    </fieldset>
  )
})
