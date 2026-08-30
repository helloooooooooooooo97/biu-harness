import { describe, expect, it } from 'vitest'
import { collectClipboardImages, uniqueImageFiles } from './clipboard-images.ts'

function png(name: string, sizeHint = 12): File {
  const bytes = new Uint8Array(sizeHint)
  return new File([bytes], name, { type: 'image/png', lastModified: 1_700_000_000_000 })
}

describe('uniqueImageFiles', () => {
  it('drops the same screenshot listed twice (files + items)', () => {
    const shot = png('image.png', 40)
    expect(uniqueImageFiles([shot, shot])).toHaveLength(1)
  })

  it('keeps two different files', () => {
    expect(uniqueImageFiles([png('a.png', 10), png('b.png', 20)])).toHaveLength(2)
  })

  it('ignores non-images', () => {
    const txt = new File([new Uint8Array(4)], 'notes.txt', { type: 'text/plain' })
    expect(uniqueImageFiles([txt, png('ok.png')])).toHaveLength(1)
  })
})

describe('collectClipboardImages', () => {
  it('dedups when files and items both expose the same screenshot', () => {
    const shot = png('paste.png', 64)
    const clipboard = {
      files: [shot] as unknown as FileList,
      items: [{ kind: 'file' as const, getAsFile: () => shot }],
    } as unknown as DataTransfer
    const images = collectClipboardImages(clipboard)
    expect(images).toHaveLength(1)
    expect(images[0]?.name).toBe('paste.png')
  })

  it('dedups files vs items clones that differ in name and mtime', () => {
    const fromFiles = png('image.png', 80)
    const fromItems = new File([new Uint8Array(80)], 'unknown.png', {
      type: 'image/png',
      lastModified: 99,
    })
    const clipboard = {
      files: [fromFiles] as unknown as FileList,
      items: [{ kind: 'file' as const, getAsFile: () => fromItems }],
    } as unknown as DataTransfer
    expect(collectClipboardImages(clipboard)).toHaveLength(1)
  })

  it('falls back to items when files is empty', () => {
    const shot = png('from-item.png', 32)
    const clipboard = {
      files: [] as unknown as FileList,
      items: [{ kind: 'file' as const, getAsFile: () => shot }],
    } as unknown as DataTransfer
    expect(collectClipboardImages(clipboard)).toHaveLength(1)
  })
})
