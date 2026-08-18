/** Token 记账与成本计算（第 48 课）。 */

export interface Usage {
  promptTokens: number
  completionTokens: number
}

export class TokenMeter {
  private prompt = 0
  private completion = 0

  record(usage: Usage): void {
    this.prompt += usage.promptTokens
    this.completion += usage.completionTokens
  }

  get(): { prompt: number; completion: number; total: number } {
    return { prompt: this.prompt, completion: this.completion, total: this.prompt + this.completion }
  }
}

export interface Pricing {
  /** 每百万 token 的价格（元）。 */
  promptPerM: number
  completionPerM: number
}

export class CostCalculator {
  constructor(private readonly pricing: Pricing) {}

  cost(tokens: { prompt: number; completion: number }): number {
    return (tokens.prompt / 1_000_000) * this.pricing.promptPerM
      + (tokens.completion / 1_000_000) * this.pricing.completionPerM
  }
}
