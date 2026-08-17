/** 测试共享工具：按队列返回预设响应的假 fetch。 */
export function fakeFetchSequence(responses: unknown[]): typeof fetch {
  const queue = [...responses]
  return async () => {
    const response = queue.shift()
    if (response === undefined) throw new Error('测试里没有更多预设响应')
    return {
      ok: true,
      status: 200,
      async json() {
        return response
      },
      async text() {
        return ''
      },
    } as Response
  }
}

/** 构造一条带 echo 工具调用的 assistant wire 消息。 */
export function echoCall(id: string, args: string): Record<string, unknown> {
  return {
    role: 'assistant',
    content: '我来执行。',
    tool_calls: [{ id, type: 'function', function: { name: 'echo', arguments: args } }],
  }
}
