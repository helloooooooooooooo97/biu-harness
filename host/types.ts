import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebSocket } from 'ws'
import type { HttpService } from './core/http.ts'
import type { PagesService } from './core/pages.ts'
import type { HubService } from './core/hub.ts'
import type { GreetService } from './plugins/greeter.ts'
import type { NotesService } from './plugins/notes.ts'

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
  kind: 'greet' | 'notes' | 'clock' | 'quotes'
}

declare module 'cordis' {
  interface Context {
    http: HttpService
    pages: PagesService
    hub: HubService
    greet: GreetService
    notes: NotesService
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
