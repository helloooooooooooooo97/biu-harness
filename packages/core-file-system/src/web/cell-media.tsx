import { useEffect, useRef, useState } from 'react'
import { Image } from 'antd'
import { PaperClipIcon, PhotoIcon, XMarkIcon } from '@heroicons/react/16/solid'
import { asAttachment, asHttpHref, asImageSrcList } from '@biu/type-file-system'
import { LocalText } from './controls.tsx'

function safeFileName(name: string) {
  const base = name.replace(/^.*[/\\]/, '').replace(/[^\p{L}\p{N}._-]+/gu, '-')
  return base || `file-${Date.now()}`
}

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

async function uploadPageAsset(file: File) {
  const name = `${Date.now()}-${safeFileName(file.name)}`
  const res = await fetch(`/api/page/file/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'content-type': file.type || 'application/octet-stream' },
    body: file,
  })
  const body = (await res.json().catch(() => ({}))) as { error?: string; href?: string; name?: string }
  if (!res.ok) throw new Error(body.error || res.statusText)
  return { name: body.name || name, href: body.href || `/api/page/file/${encodeURIComponent(name)}` }
}

function commitImages(list: string[], onCommit: (next: unknown) => void) {
  if (!list.length) onCommit('')
  else if (list.length === 1) onCommit(list[0])
  else onCommit(list)
}

function fileFingerprint(file: File) {
  return `${file.type}\0${file.size}`
}

function uniqueImageFiles(files: Array<File | null | undefined>): File[] {
  const seen = new Set<string>()
  const out: File[] = []
  for (const file of files) {
    if (!file || !file.type.startsWith('image/')) continue
    const key = fileFingerprint(file)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(file)
  }
  return out
}

function collectClipboardImages(clipboard: DataTransfer | null | undefined): File[] {
  if (!clipboard) return []
  const fromFiles = uniqueImageFiles(Array.from(clipboard.files ?? []))
  if (fromFiles.length) return fromFiles
  return uniqueImageFiles(Array.from(clipboard.items ?? []).map((item) => (item.kind === 'file' ? item.getAsFile() : null)))
}

function pasteTargetIsField(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

export function MediaField({
  kind,
  value,
  collectionPath,
  compact = false,
  onCommit,
}: {
  kind: 'image' | 'attachment' | 'url'
  value: unknown
  collectionPath?: string
  compact?: boolean
  onCommit: (next: unknown) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const takeFilesRef = useRef<(picked: File[]) => Promise<void>>(async () => {})
  const [error, setError] = useState('')
  const pageAssets = collectionPath === '/pages'
  const images = kind === 'image' ? asImageSrcList(value) : []
  const file = kind === 'attachment' ? asAttachment(value) : null
  const href = kind === 'url' ? asHttpHref(value) : ''

  async function takeFiles(picked: File[]) {
    setError('')
    try {
      if (kind === 'url') return
      const files = kind === 'image' ? picked.filter((item) => item.type.startsWith('image/')) : picked.slice(0, 1)
      if (kind === 'image' && !files.length) throw new Error('请选择图片')
      const added: string[] = []
      for (const item of files) {
        if (pageAssets) {
          const written = await uploadPageAsset(item)
          if (kind === 'image') added.push(written.href)
          else {
            onCommit({ name: item.name || written.name, href: written.href, bytes: item.size })
            return
          }
        } else if (kind === 'image') {
          added.push(await fileToDataUrl(item))
        } else {
          throw new Error('这张表还没有附件存储')
        }
      }
      if (kind === 'image') commitImages([...images, ...added], onCommit)
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    }
  }

  takeFilesRef.current = takeFiles

  useEffect(() => {
    if (kind !== 'image') return
    const onPaste = (event: ClipboardEvent) => {
      if (pasteTargetIsField(event.target)) return
      const next = collectClipboardImages(event.clipboardData)
      if (!next.length) return
      event.preventDefault()
      void takeFilesRef.current(next)
    }
    document.addEventListener('paste', onPaste, true)
    return () => document.removeEventListener('paste', onPaste, true)
  }, [kind])

  if (kind === 'url') {
    return (
      <LocalText className="fsdb-plain-input" value={href} placeholder="https://" onCommit={(next) => onCommit(next.trim())} />
    )
  }

  const label = kind === 'image' ? '粘贴或选择图片' : file ? file.name : '选择文件'

  return (
    <div
      className={`fsdb-media-field${compact ? ' is-compact' : ''}`}
      tabIndex={0}
      title={error || undefined}
      onPaste={
        kind === 'image'
          ? (event) => {
              const next = collectClipboardImages(event.clipboardData)
              if (!next.length) return
              event.preventDefault()
              void takeFiles(next)
            }
          : (event) => event.preventDefault()
      }
    >
      {kind === 'image' && images.length ? (
        <Image.PreviewGroup>
        <span className="fsdb-media-thumbs">
          {images.map((src, index) => (
            <span key={`${src}-${index}`} className="fsdb-media-thumb">
              <Image className="fsdb-media-preview" src={src} alt="" width={18} height={18} preview={{ mask: false }} />
              <button
                type="button"
                className="fsdb-media-remove"
                aria-label="移除图片"
                onClick={() => commitImages(images.filter((_, i) => i !== index), onCommit)}
              >
                <XMarkIcon aria-hidden className="size-3" />
              </button>
            </span>
          ))}
        </span>
        </Image.PreviewGroup>
      ) : null}
      {kind === 'attachment' && file ? <PaperClipIcon aria-hidden className="size-[14px] shrink-0 opacity-80" /> : null}
      <button type="button" className="fsdb-media-pick" title={label} onClick={() => inputRef.current?.click()}>
        {kind === 'image' ? <PhotoIcon aria-hidden className="size-[14px]" /> : null}
        <span className="fsdb-media-pick-label">{label}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        hidden
        multiple={kind === 'image'}
        accept={kind === 'image' ? 'image/*' : undefined}
        onChange={(event) => {
          const next = Array.from(event.target.files ?? [])
          event.target.value = ''
          if (next.length) void takeFiles(next)
        }}
      />
      {error ? <p className="fsdb-media-error">{error}</p> : null}
    </div>
  )
}
