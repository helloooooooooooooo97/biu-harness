import type { IncomingMessage, ServerResponse } from 'node:http'
import type { HttpService } from './plugins/registry/http.ts'
import type { PagesService } from './plugins/registry/pages.ts'
import type { HubService } from './plugins/orchestration/hub.ts'
import type { GreetService } from './plugins/contributors/greeter.ts'
import type { NotesService } from './plugins/contributors/notes.ts'
import type { ChatService } from './plugins/contributors/chat.ts'

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
    pages: PagesService
    hub: HubService
    greet: GreetService
    notes: NotesService
    chat: ChatService
  }

  interface Events {
    'http/ready'(info: { port: number }): void
    'pages/update'(): void
    'hub/change'(): void
    'clock/tick'(iso: string): void
    'greet/transform'(text: string, next: () => string): string
    'notes/filter'(body: string, next: () => string): string
  }
}
