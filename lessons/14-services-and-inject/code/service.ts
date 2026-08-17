/**
 * 服务定义 + 依赖注入：按拓扑顺序实例化，依赖先于依赖者。
 */
import type { Context } from './context.ts'

export interface ServiceDef {
  name: string
  deps?: string[]
  /** 接收已解析的依赖，返回服务实例。 */
  create: (deps: Record<string, unknown>) => unknown
}

/** Kahn 拓扑排序：返回按依赖顺序的服务名列表；缺失依赖/环抛错。 */
export function resolveOrder(defs: ServiceDef[]): string[] {
  const byName = new Map(defs.map((def) => [def.name, def]))
  const depsOf = new Map<string, string[]>()
  for (const def of defs) {
    for (const dep of def.deps ?? []) {
      if (!byName.has(dep)) {
        throw new Error(`缺少服务定义: ${dep}（被 ${def.name} 依赖）`)
      }
    }
    depsOf.set(def.name, [...(def.deps ?? [])])
  }

  const indegree = new Map<string, number>()
  const dependents = new Map<string, string[]>()
  for (const def of defs) {
    indegree.set(def.name, depsOf.get(def.name)!.length)
    dependents.set(def.name, [])
  }
  for (const def of defs) {
    for (const dep of depsOf.get(def.name)!) {
      dependents.get(dep)!.push(def.name)
    }
  }

  const queue = defs.filter((def) => indegree.get(def.name) === 0).map((def) => def.name)
  const order: string[] = []
  while (queue.length) {
    const name = queue.shift()!
    order.push(name)
    for (const dependent of dependents.get(name)!) {
      const next = indegree.get(dependent)! - 1
      indegree.set(dependent, next)
      if (next === 0) queue.push(dependent)
    }
  }

  if (order.length !== defs.length) {
    const cyclic = defs.map((def) => def.name).filter((name) => !order.includes(name))
    throw new Error(`检测到循环依赖: ${cyclic.join(' -> ')}`)
  }
  return order
}

/** 按拓扑顺序把服务注册进 ctx（依赖先于依赖者）。 */
export function buildServices(ctx: Context, defs: ServiceDef[]): void {
  const byName = new Map(defs.map((def) => [def.name, def]))
  for (const name of resolveOrder(defs)) {
    const def = byName.get(name)!
    const deps: Record<string, unknown> = {}
    for (const dep of def.deps ?? []) deps[dep] = ctx.get(dep)
    ctx.provide(name, def.create(deps))
  }
}
