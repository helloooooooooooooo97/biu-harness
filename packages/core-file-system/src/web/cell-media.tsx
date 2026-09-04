import { useRef, useState } from 'react'
import { PaperClipIcon, PhotoIcon } from '@heroicons/react/16/solid'
import { asAttachment, asHttpHref, asImageSrc } from '@biu/type-file-system'
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
  const imageSrc = kind === 'image' ? asImageSrc(value) : ''
  const file = kind === 'attachment' ? asAttachment(value) : null
  const href = kind === 'url' ? asHttpHref(value) || String(value ?? '') : ''

  async function takeFile(picked: File) {
    setError('')
    try {
      if (kind === 'url') return
      if (kind === 'image' && !picked.type.startsWith('image/')) throw new Error('请选择图片')
      if (pageAssets) {
        const written = await uploadPageAsset(picked)
        if (kind === 'image') onCommit(written.href)
        else onCommit({ name: picked.name || written.name, href: written.href, bytes: picked.size })
        return
      }
      if (kind === 'image') {
        onCommit(await fileToDataUrl(picked))
        return
      }
      throw new Error('这张表还没有附件存储')
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    }
  }

  if (kind === 'url') {
    return (
      <LocalText className="fsdb-plain-input" value={href} placeholder="https://" onCommit={(next) => onCommit(next.trim())} />
    )
  }

  const label = kind === 'image' ? (imageSrc ? '更换图片' : '粘贴或选择图片') : file ? file.name : '选择文件'

  return (
    <div
      className={`fsdb-media-field${compact ? ' is-compact' : ''}`}
      tabIndex={0}
      title={error || undefined}
      onPaste={
        kind === 'image'
          ? (event) => {
              const next = Array.from(event.clipboardData?.files ?? []).find((item) => item.type.startsWith('image/'))
              if (!next) {
                event.preventDefault()
                return
              }
              event.preventDefault()
              void takeFile(next)
            }
          : (event) => event.preventDefault()
      }
    >
      {kind === 'image' && imageSrc ? <img className="fsdb-media-preview" src={imageSrc} alt="" /> : null}
      {kind === 'attachment' ? <PaperClipIcon aria-hidden className="size-[14px] shrink-0 opacity-80" /> : null}
      <button type="button" className="fsdb-media-pick" title={label} onClick={() => inputRef.current?.click()}>
        {kind === 'image' ? <PhotoIcon aria-hidden className="size-[14px]" /> : null}
        <span className="fsdb-media-pick-label">{label}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        hidden
        accept={kind === 'image' ? 'image/*' : undefined}
        onChange={(event) => {
          const next = event.target.files?.[0]
          event.target.value = ''
          if (next) void takeFile(next)
        }}
      />
      {error ? <p className="fsdb-media-error">{error}</p> : null}
    </div>
  )
}
