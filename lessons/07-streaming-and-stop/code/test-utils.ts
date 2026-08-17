/** 测试共享工具：把 SSE 行序列包装成带 ReadableStream 的假 Response。 */
export function sseResponse(lines: string[]): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(`${line}\n\n`))
      controller.close()
    },
  })
  return { ok: true, status: 200, body, async json() { return {} }, async text() { return '' } } as Response
}
