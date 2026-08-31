export function ChatCount({
  count,
  title,
  className,
}: {
  count: number | undefined
  title?: string
  className?: string
}) {
  if (count == null) return null
  return (
    <span className={`sidebar-chat-count${className ? ` ${className}` : ''}`} title={title ?? `${count} 条`}>
      <span className="sidebar-chat-count-num">{count}</span>
    </span>
  )
}
