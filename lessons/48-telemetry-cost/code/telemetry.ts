/** 遥测：事件记账与导出（第 48 课）。 */

export interface TelemetryEvent {
  kind: string
  data: Record<string, unknown>
  at: string
}

export class Telemetry {
  private readonly events: TelemetryEvent[] = []

  record(kind: string, data: Record<string, unknown>): void {
    this.events.push({ kind, data, at: new Date().toISOString() })
  }

  query(kind?: string): TelemetryEvent[] {
    if (!kind) return [...this.events]
    return this.events.filter((e) => e.kind === kind)
  }

  export(): string {
    return this.events.map((e) => JSON.stringify(e)).join('\n')
  }
}
