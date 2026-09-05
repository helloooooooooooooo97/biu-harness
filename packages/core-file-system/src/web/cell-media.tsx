import { useRef, useState } from 'react'
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
              const next = Array.from(event.clipboardData?.files ?? []).filter((item) => item.type.startsWith('image/'))
              if (!next.length) {
                event.preventDefault()
                return
              }
              event.preventDefault()
              void takeFiles(next)
            }
          : (event) => event.preventDefault()
      }
    >
      {kind === 'image' && images.length ? (
        <span className="fsdb-media-thumbs">
          {images.map((src, index) => (
            <span key={`${src}-${index}`} className="fsdb-media-thumb">
              <img className="fsdb-media-preview" src={src} alt="" />
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
