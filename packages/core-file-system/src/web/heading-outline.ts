export type HeadingOutlineItem = {
  id: string
  text: string
  level: 1 | 2 | 3
}

const SKIP = ['.fsdb-detail-title', '.fsdb-detail-extra-title']

function asLevel(n: number): 1 | 2 | 3 {
  if (n === 1) return 1
  if (n === 2) return 2
  return 3
}

function headingElements(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll('h1, h2, h3')].filter(
    (el) => el instanceof HTMLElement && !SKIP.some((sel) => el.closest(sel)),
  ) as HTMLElement[]
}

function itemFromEl(el: HTMLElement, index: number): HeadingOutlineItem | null {
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return null
  return { id: `heading-${index}`, text, level: asLevel(Number(el.tagName.slice(1))) }
}

/** 只读扫描。禁止给标题写 data-*：PageEditor / TipTap 拥有这些节点，写属性会触发 MutationObserver 死循环。 */
export function headingsFromRoot(root: ParentNode): HeadingOutlineItem[] {
  const items: HeadingOutlineItem[] = []
  for (const el of headingElements(root)) {
    const item = itemFromEl(el, items.length)
    if (item) items.push(item)
  }
  return items
}

export function headingElById(root: ParentNode, id: string): HTMLElement | null {
  const items: HeadingOutlineItem[] = []
  for (const el of headingElements(root)) {
    const item = itemFromEl(el, items.length)
    if (!item) continue
    if (item.id === id) return el
    items.push(item)
  }
  return null
}

export function sameOutlineItems(a: HeadingOutlineItem[], b: HeadingOutlineItem[]) {
  return (
    a.length === b.length &&
    a.every((item, index) => {
      const other = b[index]
      return other && item.id === other.id && item.text === other.text && item.level === other.level
    })
  )
}
