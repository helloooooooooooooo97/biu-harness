export type HeadingOutlineItem = {
  id: string
  text: string
  level: 1 | 2 | 3
}

const SKIP = ['.fsdb-detail-title', '.fsdb-detail-extra-title']

function headingText(html: string) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function asLevel(n: number): 1 | 2 | 3 {
  if (n === 1) return 1
  if (n === 2) return 2
  return 3
}

/** 从 HTML 抽出 h1–h3，忽略详情页标题和附加栏标题。 */
export function headingsFromHtml(html: string): HeadingOutlineItem[] {
  const items: HeadingOutlineItem[] = []
  const re = /<h([123])\b([^>]*)>([\s\S]*?)<\/h\1>/gi
  let match: RegExpExecArray | null
  let index = 0
  while ((match = re.exec(html))) {
    const attrs = match[2] ?? ''
    if (/\bfsdb-detail-title\b/.test(attrs) || /\bfsdb-detail-extra-title\b/.test(attrs)) continue
    const text = headingText(match[3] ?? '')
    if (!text) continue
    items.push({ id: `heading-${index}`, text, level: asLevel(Number(match[1])) })
    index += 1
  }
  return items
}

export function headingsFromRoot(root: ParentNode): HeadingOutlineItem[] {
  const nodes = [...root.querySelectorAll('h1, h2, h3')].filter(
    (el) => !SKIP.some((sel) => el.closest(sel)),
  )
  return nodes.flatMap((el, index) => {
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (!text) return []
    const id = el.getAttribute('data-heading-outline') || `heading-${index}`
    el.setAttribute('data-heading-outline', id)
    return [{ id, text, level: asLevel(Number(el.tagName.slice(1))) }]
  })
}
