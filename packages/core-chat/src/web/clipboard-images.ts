const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])

export { IMAGE_MIMES }

function fileFingerprint(file: File): string {
  return `${file.type}\0${file.size}`
}

/** Drop / file-input: keep image files only. */
export function collectImageFiles(list: FileList | File[] | null | undefined): File[] {
  if (!list) return []
  return uniqueImageFiles(Array.from(list))
}

/**
 * Paste often exposes the same screenshot via both `clipboardData.files`
 * and `clipboardData.items`, as two File objects with different names/mtime.
 * Prefer `files` when it already has images; otherwise read `items`.
 * Dedup leftover twins by type+size.
 */
export function uniqueImageFiles(files: Array<File | null | undefined>): File[] {
  const seen = new Set<string>()
  const out: File[] = []
  for (const file of files) {
    if (!file || !IMAGE_MIMES.has(file.type)) continue
    const key = fileFingerprint(file)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(file)
  }
  return out
}

export function collectClipboardImages(clipboard: DataTransfer | null | undefined): File[] {
  if (!clipboard) return []
  const fromFiles = uniqueImageFiles(Array.from(clipboard.files ?? []))
  if (fromFiles.length) return fromFiles
  return uniqueImageFiles(
    Array.from(clipboard.items).map((item) => (item.kind === 'file' ? item.getAsFile() : null)),
  )
}
