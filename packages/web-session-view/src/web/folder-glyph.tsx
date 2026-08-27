import { FolderIcon } from '@heroicons/react/20/solid'

/** 文件夹：默认 16px；侧栏项目行会再加 size-5。 */
export function FolderGlyph({ className }: { className?: string }) {
  return <FolderIcon className={['size-4 shrink-0', className].filter(Boolean).join(' ')} aria-hidden />
}
