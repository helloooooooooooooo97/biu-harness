/** 遥测、token 记账与成本（第 48 课）。 */

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
    return kind ? this.events.filter((e) => e.kind === kind) : [...this.events]
  }

  export(): string {
    return this.events.map((e) => JSON.stringify(e)).join('\n')
  }
}

export class TokenMeter {
  private prompt = 0
  private completion = 0

  record(usage: { promptTokens: number; completionTokens: number }): void {
    this.prompt += usage.promptTokens
    this.completion += usage.completionTokens
  }

  get(): { prompt: number; completion: number; total: number } {
    return { prompt: this.prompt, completion: this.completion, total: this.prompt + this.completion }
  }
}

export class CostCalculator {
  constructor(private readonly pricing: { promptPerM: number; completionPerM: number }) {}

  cost(tokens: { prompt: number; completion: number }): number {
    return (tokens.prompt / 1_000_000) * this.pricing.promptPerM + (tokens.completion / 1_000_000) * this.pricing.completionPerM
  }
}
