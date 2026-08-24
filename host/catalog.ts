import type { Plugin } from 'cordis'
import * as uppercase from './plugins/contributors/uppercase.ts'
import * as clock from './plugins/contributors/clock.ts'
import * as chat from './plugins/contributors/chat.ts'
import * as dashboard from './plugins/contributors/dashboard.ts'
import * as logger from './plugins/contributors/logger.ts'
import * as mascotEasterEgg from './plugins/contributors/mascot-easter-egg.ts'

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
  /** 前端包名（cordis.plugins.json 外部插件） */
  ui?: string
  packageName?: string
}

/** 内置插件；可热插拔能力只写在 cordis.plugins.json，主仓不引用具体包。 */
export const builtinCatalog: CatalogEntry[] = [
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
    id: 'chat',
    name: '对话',
    layer: 'capability',
    blurb: 'ctx.chat → session + ctx.agents。',
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
    id: 'logger',
    name: '事件日志',
    layer: 'capability',
    blurb: '旁观 internal/dispatch。',
    plugin: logger,
    inject: logger.inject,
    togglable: true,
    enabled: true,
  },
  {
    id: 'mascot-easter-egg',
    name: 'Mascot 彩蛋',
    layer: 'capability',
    blurb: 'mascot_dance 工具：让所有 mascot 一起跳舞。',
    plugin: mascotEasterEgg,
    inject: mascotEasterEgg.inject,
    togglable: true,
    enabled: true,
  },
]

/** @deprecated 使用 resolveCatalog()；保留同步 builtin 别名以免旧引用炸掉。 */
export const catalog = builtinCatalog
