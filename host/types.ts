import type { IncomingMessage, ServerResponse } from 'node:http'
import type { HttpService } from './plugins/registry/http.ts'
import type { HubService } from './plugins/registry/hub.ts'
import type { ToolsService } from './plugins/registry/tools.ts'
import type { ToolRequest } from './plugins/registry/tools.ts'
import type { LlmService } from './plugins/orchestration/llm.ts'
import type { AgentLoopService } from './plugins/orchestration/agent-loop.ts'
import type { PreStepReq } from './plugins/orchestration/agent-loop.ts'
import type { AgentsService } from './plugins/orchestration/agents.ts'
import type { ApprovalsService } from './plugins/orchestration/approvals.ts'
import type { GreetService } from './plugins/contributors/greeter.ts'
import type { NotesService } from './plugins/contributors/notes.ts'
import type { ChatService } from './plugins/contributors/chat.ts'
import type { SessionsService } from './plugins/core/sessions.ts'
import type { SessionEvent } from './plugins/core/session-types.ts'
import type { SessionStoreService } from './plugins/storage/session-store.ts'
import type { SystemPromptService } from './plugins/core/system-prompt.ts'
import type { FsService } from './plugins/seams/fs.ts'
import type { SubprocessService } from './plugins/seams/subprocess.ts'
import type { SandboxService } from './plugins/seams/sandbox.ts'
import type { ShellService } from './plugins/seams/shell.ts'
import type { JobsService } from './plugins/seams/jobs.ts'
import type { McpService } from './plugins/seams/mcp.ts'
import type { TerminalService } from './plugins/seams/terminal.ts'
import type { LspService } from './plugins/seams/lsp.ts'
import type { SubagentsService } from './plugins/seams/subagents.ts'

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
    greet: GreetService
    notes: NotesService
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
    'agent/status'(payload: { status: 'idle' | 'running'; step?: number }): void
    'agent/pre-step'(req: PreStepReq, next: () => PreStepReq): PreStepReq
    'session/event'(payload: { sessionId: string; event: SessionEvent }): void
    'tools/pre-execute'(req: ToolRequest, next: () => ToolRequest): ToolRequest
    'tools/post-execute'(payload: { name: string; ok: boolean; detail: string }): void
    'llm/request'(payload: { model: string }): void
    'llm/stream'(payload: { text: string }): void
    'fs/read'(path: string): void
    'fs/write'(path: string): void
    'fs/list'(path: string): void
    'sandbox/wrap'(payload: { argv: string[]; cwd: string }): void
    'clock/tick'(iso: string): void
    'greet/transform'(text: string, next: () => string): string
    'notes/filter'(body: string, next: () => string): string
  }
}
