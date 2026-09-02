export const name = 'context'
export const inject = []

/** 上下文压缩已改为 sessions 表 db_action：compact / clear / retrieve / status。 */
export function apply() {}

export { lastUsageBeforeCompact, retrieveHistory } from '@biu/host-sessions'
