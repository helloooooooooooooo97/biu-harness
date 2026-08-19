import type { Plugin } from 'cordis'
import * as greeter from './plugins/contributors/greeter.ts'
import * as uppercase from './plugins/contributors/uppercase.ts'
import * as notes from './plugins/contributors/notes.ts'
import * as clock from './plugins/contributors/clock.ts'
import * as quotes from './plugins/contributors/quotes.ts'
import * as chat from './plugins/contributors/chat.ts'
import * as dashboard from './plugins/orchestration/dashboard.ts'
import * as logger from './plugins/contributors/logger.ts'
import * as polite from './plugins/contributors/polite.ts'

export interface CatalogEntry {
  id: string
  name: string
  layer: 'web' | 'capability'
  blurb: string
  plugin: Plugin
  inject?: string[]
  togglable: boolean
  enabled: boolean
  config?: unknown
}

export const catalog: CatalogEntry[] = [
  {
    id: 'dashboard',
    name: '控制台',
    layer: 'web',
    blurb: '投影 snapshot 与插件开关 API。',
    plugin: dashboard,
    inject: dashboard.inject,
    togglable: false,
    enabled: true,
  },
  {
    id: 'greeter',
    name: '问候服务',
    layer: 'capability',
    blurb: 'ctx.greet + GET /api/greet。',
    plugin: greeter,
    inject: greeter.inject,
    togglable: true,
    enabled: true,
  },
  {
    id: 'chat',
    name: '对话',
    layer: 'capability',
    blurb: 'ctx.chat + POST /api/chat。',
    plugin: chat,
    inject: chat.inject,
    togglable: true,
    enabled: true,
  },
  {
    id: 'uppercase',
    name: '大写拦截器',
    layer: 'capability',
    blurb: '挂在 greet/transform 上。',
    plugin: uppercase,
    inject: uppercase.inject,
    togglable: true,
    enabled: true,
  },
  {
    id: 'notes',
    name: '便签',
    layer: 'capability',
    blurb: 'GET/POST /api/notes。',
    plugin: notes,
    inject: notes.inject,
    togglable: true,
    enabled: true,
  },
  {
    id: 'clock',
    name: '心跳时钟',
    layer: 'capability',
    blurb: 'WebSocket 推 clock/tick。',
    plugin: clock,
    inject: clock.inject,
    togglable: true,
    enabled: true,
  },
  {
    id: 'quotes',
    name: '旁白',
    layer: 'capability',
    blurb: 'notes/filter 旁白。',
    plugin: quotes,
    inject: quotes.inject,
    togglable: true,
    enabled: false,
  },
  {
    id: 'polite',
    name: '礼貌过滤器',
    layer: 'capability',
    blurb: '另一条 notes/filter。',
    plugin: polite,
    inject: polite.inject,
    togglable: true,
    enabled: false,
  },
  {
    id: 'logger',
    name: '事件日志',
    layer: 'capability',
    blurb: '旁观 internal/dispatch。',
    plugin: logger,
    inject: logger.inject,
    togglable: true,
    enabled: true,
  },
]
