import { useEffect, useRef, useState } from 'react'
import { Image } from 'antd'
import { PaperClipIcon, PhotoIcon, XMarkIcon, ArrowDownTrayIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/16/solid'
import { asAttachmentList, asHttpHref, asImageSrcList, commitAttachments } from '@biu/type-file-system'
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

function uniqueImageFiles(files: Array<File | null | undefined>): File[] {
  const seen = new Set<string>()
  const out: File[] = []
  for (const file of files) {
    if (!file || !file.type.startsWith('image/')) continue
    const key = `${file.name}\0${file.size}\0${file.lastModified}\0${file.type}`
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

export function AttachmentFile({
  file,
  onRemove,
}: {
  file: { name: string; href: string }
  onRemove?: () => void
}) {
  return (
    <span className="fsdb-file">
      <PaperClipIcon aria-hidden className="size-[14px] shrink-0 opacity-80" />
      <span className="fsdb-file-name">{file.name}</span>
      <span className="fsdb-file-tools">
        <a
          className="tasks-icon-btn fsdb-file-dl"
          href={file.href}
          download={file.name}
          title="下载"
          aria-label={`下载 ${file.name}`}
          data-testid="fsdb-file-download"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <ArrowDownTrayIcon aria-hidden className="size-[14px]" />
        </a>
        {onRemove ? (
          <button
            type="button"
            className="tasks-icon-btn is-danger fsdb-file-del"
            title="删除"
            aria-label={`删除 ${file.name}`}
            data-testid="fsdb-file-remove"
            onClick={(event) => {
              event.stopPropagation()
              onRemove()
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <XMarkIcon aria-hidden className="size-[14px]" />
          </button>
        ) : null}
      </span>
    </span>
  )
}

export function UrlHref({ href }: { href: string }) {
  return (
    <span className="fsdb-file">
      <span className="fsdb-file-name">{href}</span>
      <span className="fsdb-file-tools">
        <a
          className="tasks-icon-btn fsdb-file-open"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title="新标签页打开"
          aria-label="新标签页打开"
          data-testid="fsdb-url-open"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <ArrowTopRightOnSquareIcon aria-hidden className="size-[14px]" />
        </a>
      </span>
    </span>
  )
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
  const imagesRef = useRef(images)
  imagesRef.current = images
  const files = kind === 'attachment' ? asAttachmentList(value) : []
  const filesRef = useRef(files)
  filesRef.current = files
  const href = kind === 'url' ? asHttpHref(value) : ''

  async function takeFiles(picked: File[]) {
    setError('')
    try {
      if (kind === 'url') return
      const files = kind === 'image' ? picked.filter((item) => item.type.startsWith('image/')) : picked
      if (kind === 'image' && !files.length) throw new Error('请选择图片')
      if (kind === 'attachment' && !files.length) throw new Error('请选择文件')
      const addedImages: string[] = []
      const addedFiles: Array<{ name: string; href: string; bytes?: number }> = []
      for (const item of files) {
        if (pageAssets) {
          const written = await uploadPageAsset(item)
          if (kind === 'image') addedImages.push(written.href)
          else addedFiles.push({ name: item.name || written.name, href: written.href, bytes: item.size })
        } else if (kind === 'image') {
          addedImages.push(await fileToDataUrl(item))
        } else {
          throw new Error('这张表还没有附件存储')
        }
      }
      if (kind === 'image') commitImages([...imagesRef.current, ...addedImages], onCommit)
      else onCommit(commitAttachments([...filesRef.current, ...addedFiles]))
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

  const label = kind === 'image' ? '粘贴或选择图片' : files.length ? '添加附件' : '选择文件'

  return (
    <div
      className={`fsdb-media-field${compact ? ' is-compact' : ''}${kind === 'attachment' ? ' is-files' : ''}`}
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
      {kind === 'attachment' && files.length ? (
        <span className="fsdb-files">
          {files.map((item, index) => (
            <AttachmentFile
              key={`${item.href}-${index}`}
              file={item}
              onRemove={() => onCommit(commitAttachments(files.filter((_, i) => i !== index)))}
            />
          ))}
        </span>
      ) : null}
      <button type="button" className="fsdb-media-pick" title={label} onClick={() => inputRef.current?.click()}>
        {kind === 'image' ? <PhotoIcon aria-hidden className="size-[14px]" /> : <PaperClipIcon aria-hidden className="size-[14px]" />}
        <span className="fsdb-media-pick-label">{label}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        hidden
        multiple={kind === 'image' || kind === 'attachment'}
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
