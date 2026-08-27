import { FolderIcon } from '@heroicons/react/20/solid'

/** 文件夹图标。未传 className 时为 16×16；侧栏项目行传 size-5。 */
export function FolderGlyph({ className }: { className?: string }) {
  return <FolderIcon className={className ? `shrink-0 ${className}` : 'size-4 shrink-0'} aria-hidden />
}
