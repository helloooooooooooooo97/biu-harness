/** 与 Lucide `folder` 同路径、同线宽，避免手画 SVG 和 Lucide 套件视觉大小不一致。 */
export function FolderGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  )
}
