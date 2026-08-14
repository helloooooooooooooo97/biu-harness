import type { Plugin } from 'cordis'
import * as greeter from './plugins/greeter.ts'
import * as uppercase from './plugins/uppercase.ts'
import * as notes from './plugins/notes.ts'
import * as clock from './plugins/clock.ts'
import * as quotes from './plugins/quotes.ts'
import * as dashboard from './plugins/dashboard.ts'
import * as logger from './plugins/logger.ts'
import * as polite from './plugins/polite.ts'

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
    blurb: '把 runtime 状态投影成网站。它自己也是插件。',
    plugin: dashboard,
    inject: dashboard.inject,
    togglable: false,
    enabled: true,
  },
  {
    id: 'greeter',
    name: '问候服务',
    layer: 'capability',
    blurb: '提供 ctx.greet。真正的文案会经过 greet/transform 瀑布流。',
    plugin: greeter,
    inject: greeter.inject,
    togglable: true,
    enabled: true,
  },
  {
    id: 'uppercase',
    name: '大写拦截器',
    layer: 'capability',
    blurb: '挂在 greet/transform 上，演示 waterfall 中间件。关掉后问候立刻变回原样。',
    plugin: uppercase,
    inject: uppercase.inject,
    togglable: true,
    enabled: true,
  },
  {
    id: 'notes',
    name: '便签',
    layer: 'capability',
    blurb: '路由、页面、服务一起注册；卸载时全部撤回。',
    plugin: notes,
    inject: notes.inject,
    togglable: true,
    enabled: true,
  },
  {
    id: 'clock',
    name: '心跳时钟',
    layer: 'capability',
    blurb: '用 ctx.effect 管理定时器，通过 WebSocket 推送 clock/tick。',
    plugin: clock,
    inject: clock.inject,
    togglable: true,
    enabled: true,
  },
  {
    id: 'quotes',
    name: '旁白',
    layer: 'capability',
    blurb: '往便签管道挂一层 notes/filter，给内容加 Cordis 旁白。',
    plugin: quotes,
    inject: quotes.inject,
    togglable: true,
    enabled: false,
  },
  {
    id: 'polite',
    name: '礼貌过滤器',
    layer: 'capability',
    blurb: '另一条 notes/filter 监听，和旁白叠在同一条瀑布流上。',
    plugin: polite,
    inject: polite.inject,
    togglable: true,
    enabled: false,
  },
  {
    id: 'logger',
    name: '事件日志',
    layer: 'capability',
    blurb: '旁观 internal/dispatch，本身不提供 UI。',
    plugin: logger,
    inject: logger.inject,
    togglable: true,
    enabled: true,
  },
]
