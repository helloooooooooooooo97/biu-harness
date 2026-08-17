/** Agent 服务接口：agent 生命周期的契约。 */

export interface Agent {
  readonly id: string
  send(input: string): void
  cancel(): void
}

export interface AgentRegistryService {
  create(id?: string): Agent
  get(id: string): Agent | undefined
  dispose(id: string): void
}
