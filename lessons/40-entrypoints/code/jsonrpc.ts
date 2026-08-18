/** JsonRpcServer：行级 JSON-RPC（第 40 课）。 */

export interface JsonRpcRequest {
  jsonrpc?: string
  id?: number | string
  method: string
  params?: Record<string, unknown>
}

export type RpcHandler = (params: Record<string, unknown> | undefined) => Promise<unknown>

export class JsonRpcServer {
  constructor(private readonly handlers: Record<string, RpcHandler>) {}

  /** 处理一行请求文本，返回响应文本（错误也返回 JSON-RPC error）。 */
  async handleLine(line: string): Promise<string> {
    let request: JsonRpcRequest
    try {
      request = JSON.parse(line) as JsonRpcRequest
    } catch {
      return JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: '解析错误' } })
    }
    const handler = this.handlers[request.method]
    if (!handler) {
      return JSON.stringify({ jsonrpc: '2.0', id: request.id ?? null, error: { code: -32601, message: `未知方法: ${request.method}` } })
    }
    try {
      const result = await handler(request.params)
      return JSON.stringify({ jsonrpc: '2.0', id: request.id ?? null, result })
    } catch (err) {
      return JSON.stringify({
        jsonrpc: '2.0',
        id: request.id ?? null,
        error: { code: -32603, message: err instanceof Error ? err.message : String(err) },
      })
    }
  }
}
