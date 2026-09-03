import type { Context } from 'cordis'

export const name = 'core-editor'
export const inject: string[] = []

/** 编辑器只在 Web；Host 占位以便目录加载。 */
export function apply(_ctx: Context) {}
