const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])

export { IMAGE_MIMES }

function fileFingerprint(file: File): string {
  return `${file.name}\0${file.size}\0${file.lastModified}\0${file.type}`
}

/** Drop / file-input: keep image files only. */
export function collectImageFiles(list: FileList | File[] | null | undefined): File[] {
  if (!list) return []
  return uniqueImageFiles(Array.from(list))
}

/**
 * Paste often exposes the same screenshot via both `clipboardData.files`
 * and `clipboardData.items`. Dedup by name/size/mtime/type so one paste
 * becomes one pending image.
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
  const fromFiles = Array.from(clipboard.files ?? [])
  const fromItems = Array.from(clipboard.items)
    .map((item) => (item.kind === 'file' ? item.getAsFile() : null))
  return uniqueImageFiles([...fromFiles, ...fromItems])
}
