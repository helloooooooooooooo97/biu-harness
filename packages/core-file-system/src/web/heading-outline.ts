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

function preview(text: string, max = 48) {
  const one = text.replace(/\s+/g, ' ').trim()
  if (!one) return ''
  return one.length > max ? `${one.slice(0, max)}…` : one
}

function headingElements(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll('h1, h2, h3')].filter(
    (el) => el instanceof HTMLElement && !SKIP.some((sel) => el.closest(sel)),
  ) as HTMLElement[]
}

function chatUserElements(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll('[data-chat-kind="user"][data-node-id]')].filter(
    (el): el is HTMLElement => el instanceof HTMLElement,
  )
}

function itemFromEl(el: HTMLElement, index: number): HeadingOutlineItem | null {
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return null
  return { id: `heading-${index}`, text, level: asLevel(Number(el.tagName.slice(1))) }
}

function documentOrder(a: HTMLElement, b: HTMLElement) {
  const pos = a.compareDocumentPosition(b)
  if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1
  if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1
  return 0
}

function escapeId(id: string) {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(id) : id
}

/** 只读扫描。禁止给标题写 data-*：PageEditor / TipTap 拥有这些节点，写属性会触发 MutationObserver 死循环。 */
export function headingsFromRoot(root: ParentNode): HeadingOutlineItem[] {
  const users = chatUserElements(root)
  const headings = headingElements(root)
  const items: HeadingOutlineItem[] = []
  let headingIndex = 0
  for (const el of [...users, ...headings].sort(documentOrder)) {
    if (el.matches('[data-chat-kind="user"]')) {
      const id = el.getAttribute('data-node-id')?.trim()
      const text = preview(el.textContent ?? '')
      if (!id || !text) continue
      items.push({ id, text, level: 1 })
      continue
    }
    if (users.some((user) => user.contains(el))) continue
    const item = itemFromEl(el, headingIndex)
    if (item) {
      items.push(item)
      headingIndex += 1
    }
  }
  return items
}

export function headingElById(root: ParentNode, id: string): HTMLElement | null {
  const user = root.querySelector(`[data-chat-kind="user"][data-node-id="${escapeId(id)}"]`)
  if (user instanceof HTMLElement) return user
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
