import { Image } from 'antd'

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
  if (!images.length) return null
  return (
    <Image.PreviewGroup>
      <div className="composer-image-row" data-testid="composer-image-thumbs">
        {images.map((image, index) => (
          <div key={`${image.name}-${index}`} className="composer-image-thumb-wrap">
            <Image
              className="composer-image-thumb"
              src={image.url}
              alt={image.name}
              preview={{ mask: false }}
            />
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
    </Image.PreviewGroup>
  )
}
