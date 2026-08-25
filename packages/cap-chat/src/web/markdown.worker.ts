/// <reference lib="webworker" />
import { marked } from 'marked'
import { markdownHighlight } from './markdown-highlight.ts'

marked.setOptions({
  gfm: true,
  breaks: false,
  async: false,
})
marked.use(markdownHighlight)

export type MarkdownWorkerRequest = {
  id: number
  text: string
}

export type MarkdownWorkerResponse =
  | { id: number; html: string }
  | { id: number; error: string }

self.onmessage = (event: MessageEvent<MarkdownWorkerRequest>) => {
  const { id, text } = event.data
  try {
    const html = marked.parse(text, { async: false }) as string
    const response: MarkdownWorkerResponse = { id, html }
    self.postMessage(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const response: MarkdownWorkerResponse = { id, error: message }
    self.postMessage(response)
  }
}
