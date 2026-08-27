import { FolderIcon } from '@heroicons/react/16/solid'

/** 与侧栏其它 Heroicons 16 solid 对齐。 */
export function FolderGlyph({ className }: { className?: string }) {
  return <FolderIcon className={['size-4 shrink-0', className].filter(Boolean).join(' ')} aria-hidden />
}
