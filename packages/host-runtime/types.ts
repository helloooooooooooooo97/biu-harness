import type { IncomingMessage, ServerResponse } from 'node:http'
import type { HttpService } from './src/registry/http.ts'
import type { HubService } from './src/registry/hub.ts'
import type { ToolsService } from './src/registry/tools.ts'
import type { ToolRequest } from './src/registry/tools.ts'
import type { LlmService } from './src/orchestration/llm.ts'
import type { AgentLoopService } from './src/orchestration/agent-loop.ts'
import type { PreStepReq } from './src/orchestration/agent-loop.ts'
import type { AgentsService } from './src/orchestration/agents.ts'
import type { ApprovalsService } from './src/orchestration/approvals.ts'
import type { ChatService } from './src/contributors/chat.ts'
import type { SessionsService } from './src/core/sessions.ts'
import type { SessionEvent } from './src/core/session-types.ts'
import type { SessionStoreService } from './src/storage/session-store.ts'
import type { SystemPromptService } from './src/core/system-prompt.ts'
import type { FsService } from './src/seams/fs.ts'
import type { SubprocessService } from './src/seams/subprocess.ts'
import type { SandboxService } from './src/seams/sandbox.ts'
import type { ShellService } from './src/seams/shell.ts'
import type { JobsService } from './src/seams/jobs.ts'
import type { McpService } from './src/seams/mcp.ts'
import type { TerminalService } from './src/seams/terminal.ts'
import type { LspService } from './src/seams/lsp.ts'
import type { SubagentsService } from './src/seams/subagents.ts'

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface RouteContext {
  req: IncomingMessage
  res: ServerResponse
  params: Record<string, string>
  query: URLSearchParams
  json<T = unknown>(): Promise<T>
  send(status: number, body: unknown): void
}

export type RouteHandler = (ctx: RouteContext) => void | Promise<void>

export interface PageSpec {
  id: string
  title: string
  subtitle: string
  plugin: string
  kind: string
}

declare module 'cordis' {
  interface Context {
    http: HttpService
    hub: HubService
    tools: ToolsService
    llm: LlmService
    agentLoop: AgentLoopService
    agents: AgentsService
    approvals: ApprovalsService
    chat: ChatService
    sessionStore: SessionStoreService
    sessions: SessionsService
    systemPrompt: SystemPromptService
    fs: FsService
    subprocess: SubprocessService
    sandbox: SandboxService
    shell: ShellService
    jobs: JobsService
    mcp: McpService
    terminals: TerminalService
    lsp: LspService
    subagents: SubagentsService
  }

  interface Events {
    'http/ready'(info: { port: number }): void
    'hub/change'(): void
    'agent/status'(payload: { sessionId: string; status: 'idle' | 'running'; step?: number }): void
    'agent/inbox'(payload: {
      sessionId: string
      inbox: Array<{ id: string; kind: 'wake' | 'inject'; text: string }>
    }): void
    'agent/pre-step'(req: PreStepReq, next: () => PreStepReq): PreStepReq
    'session/event'(payload: { sessionId: string; event: SessionEvent }): void
    'tools/pre-execute'(req: ToolRequest, next: () => ToolRequest): ToolRequest
    'tools/post-execute'(payload: { name: string; ok: boolean; detail: string }): void
    'llm/request'(payload: { model: string; provider?: string }): void
    'llm/stream'(payload: { text: string }): void
    'fs/read'(path: string): void
    'fs/write'(path: string): void
    'fs/list'(path: string): void
    'sandbox/wrap'(payload: { argv: string[]; cwd: string }): void
    'clock/tick'(iso: string): void
    'greet/transform'(text: string, next: () => string): string
  }
}
