import { useEffect, useState } from 'react'

export type ChatImage = {
  name: string
  mime: string
  url: string
}

export function ImageThumbs({
  images,
  onRemove,
}: {
  images: ChatImage[]
  onRemove?: (index: number) => void
}) {
  const [open, setOpen] = useState<number | null>(null)
  useEffect(() => {
    if (open == null) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  if (!images.length) return null
  const current = open != null ? images[open] : null
  return (
    <>
      <div className="composer-image-row" data-testid="composer-image-thumbs">
        {images.map((image, index) => (
          <div key={`${image.name}-${index}`} className="composer-image-thumb-wrap">
            <button
              type="button"
              className="composer-image-thumb"
              title={image.name}
              aria-label={`查看 ${image.name}`}
              onClick={() => setOpen(index)}
            >
              <img src={image.url} alt={image.name} />
            </button>
            {onRemove ? (
              <button
                type="button"
                className="composer-image-remove"
                title="移除图片"
                aria-label={`移除 ${image.name}`}
                onClick={() => onRemove(index)}
              >
                ×
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {current ? (
        <div
          className="composer-image-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={current.name}
          data-testid="image-lightbox"
          onClick={() => setOpen(null)}
        >
          <img src={current.url} alt={current.name} onClick={(event) => event.stopPropagation()} />
        </div>
      ) : null}
    </>
  )
}
