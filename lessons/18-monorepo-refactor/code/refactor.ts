/**
 * 重构清单与校验：哪些课的文件搬进哪个包。
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

export interface RefactorStep {
  from: string
  to: string
  note: string
}

/** 第 05/06 课垂直切片 → workspace 包的映射。 */
export const REFACTOR_MAP: RefactorStep[] = [
  {
    from: 'lessons/05-vertical-slice-agent/code/chat-client.ts',
    to: 'packages/llm-deepseek/src/chat-client.ts',
    note: '传输实现 → llm-deepseek（实现 llm 接口）',
  },
  {
    from: 'lessons/05-vertical-slice-agent/code/agent-v1.ts',
    to: 'packages/core-agent-loop/src/agent-v1.ts',
    note: '最小循环 → core-agent-loop',
  },
  {
    from: 'lessons/06-tool-call-loop/code/tool.ts',
    to: 'packages/core-tools/src/tool.ts',
    note: '工具接口与实现 → core-tools',
  },
  {
    from: 'lessons/06-tool-call-loop/code/tool-registry.ts',
    to: 'packages/core-tools/src/tool-registry.ts',
    note: '工具注册表 → core-tools',
  },
]

/** 检查重构是否完成：列出 workspace 里缺失的目标文件。 */
export class RefactorChecker {
  constructor(private readonly root: string) {}

  missing(): string[] {
    return REFACTOR_MAP
      .filter((step) => !existsSync(resolve(this.root, step.to)))
      .map((step) => step.to)
  }
}
