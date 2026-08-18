/** JSON-RPC 服务器（复用第 40 课）。 */

export type RpcHandler = (params: Record<string, unknown> | undefined) => Promise<unknown>

export class JsonRpcServer {
  constructor(private readonly handlers: Record<string, RpcHandler>) {}

  async handleLine(line: string): Promise<string> {
    let request: { id?: number | string; method: string; params?: Record<string, unknown> }
    try {
      request = JSON.parse(line)
    } catch {
      return JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: '解析错误' } })
    }
    const handler = this.handlers[request.method]
    if (!handler) {
      return JSON.stringify({ jsonrpc: '2.0', id: request.id ?? null, error: { code: -32601, message: `未知方法: ${request.method}` } })
    }
    try {
      return JSON.stringify({ jsonrpc: '2.0', id: request.id ?? null, result: await handler(request.params) })
    } catch (err) {
      return JSON.stringify({ jsonrpc: '2.0', id: request.id ?? null, error: { code: -32603, message: err instanceof Error ? err.message : String(err) } })
    }
  }
}
