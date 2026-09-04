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
  onCommit,
}: {
  kind: 'image' | 'attachment' | 'url'
  value: unknown
  collectionPath?: string
  onCommit: (next: unknown) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const pageAssets = collectionPath === '/pages'
  const imageSrc = kind === 'image' ? asImageSrc(value) : ''
  const file = kind === 'attachment' ? asAttachment(value) : null
  const href = kind === 'url' ? asHttpHref(value) || String(value ?? '') : file?.href || imageSrc

  async function takeFile(picked: File) {
    setError('')
    try {
      if (kind === 'url') return
      if (pageAssets) {
        const written = await uploadPageAsset(picked)
        if (kind === 'image') onCommit(written.href)
        else onCommit({ name: picked.name || written.name, href: written.href, bytes: picked.size })
        return
      }
      if (kind === 'image') {
        if (!picked.type.startsWith('image/')) throw new Error('请选择图片')
        onCommit(await fileToDataUrl(picked))
        return
      }
      throw new Error('这张表还没有附件存储，请填 http(s) 链接')
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    }
  }

  return (
    <div
      className="fsdb-media-field"
      tabIndex={0}
      onPaste={(event) => {
        const next = Array.from(event.clipboardData?.files ?? []).find((item) =>
          kind === 'image' ? item.type.startsWith('image/') : Boolean(item.size),
        )
        if (!next) return
        event.preventDefault()
        void takeFile(next)
      }}
    >
      {kind === 'image' && imageSrc ? <img className="fsdb-media-preview" src={imageSrc} alt="" /> : null}
      {kind === 'attachment' && file ? (
        <a className="fsdb-link" href={file.href} target="_blank" rel="noreferrer">
          {file.name}
        </a>
      ) : null}
      {kind !== 'url' ? (
        <div className="fsdb-media-row">
          <button type="button" className="fsdb-media-pick" onClick={() => inputRef.current?.click()}>
            {kind === 'image' ? <PhotoIcon aria-hidden className="size-[14px]" /> : <PaperClipIcon aria-hidden className="size-[14px]" />}
            {kind === 'image' ? '选择或粘贴图片' : '选择文件'}
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
        </div>
      ) : null}
      <LocalText
        className="fsdb-plain-input"
        value={href}
        placeholder={kind === 'url' ? 'https://' : '或填写链接'}
        onCommit={(next) => {
          setError('')
          if (kind === 'attachment') {
            const name = file?.name || next.split('/').filter(Boolean).pop() || 'file'
            onCommit(next.trim() ? { name, href: next.trim(), bytes: file?.bytes } : '')
            return
          }
          onCommit(next.trim())
        }}
      />
      {error ? <p className="fsdb-media-error">{error}</p> : null}
    </div>
  )
}
