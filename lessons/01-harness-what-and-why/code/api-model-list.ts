/**
 * 列出 DeepSeek 可用模型（TS + OOD 版）。
 *
 * 用法：
 *   npm start                                # 有 key 走 API，无 key 输出内置清单
 *   DEEPSEEK_API_KEY=sk-... npm start
 *   npm start -- --json                      # 输出 JSON
 */
export interface ModelInfo {
  id: string
  ownedBy: string
  created: string | number
}

export interface ModelClientOptions {
  apiKey?: string
  baseUrl?: string
  fetchImpl?: typeof fetch
}

const FALLBACK_MODELS: readonly ModelInfo[] = [
  { id: 'deepseek-chat', ownedBy: 'deepseek', created: '' },
  { id: 'deepseek-reasoner', ownedBy: 'deepseek', created: '' },
]

/** 负责与 DeepSeek /models 接口对话的客户端。 */
export class ModelClient {
  constructor(private readonly options: ModelClientOptions = {}) {}

  /** 列出模型：有 key 走 GET /models，无 key 走内置清单。 */
  async list(): Promise<{ source: 'api' | 'fallback'; models: ModelInfo[] }> {
    const apiKey = this.options.apiKey ?? process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      return { source: 'fallback', models: [...FALLBACK_MODELS] }
    }
    const baseUrl = this.options.baseUrl
      ?? process.env.DEEPSEEK_BASE_URL
      ?? 'https://api.deepseek.com'
    const fetchImpl = this.options.fetchImpl ?? fetch

    const res = await fetchImpl(`${baseUrl}/models`, {
      headers: { authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`)
    }
    return { source: 'api', models: ModelClient.parse(await res.json()) }
  }

  /** 把任意响应形状归一化成模型行（兼容 data/models/数组）。 */
  static parse(json: unknown): ModelInfo[] {
    const value = json as { data?: unknown; models?: unknown } | unknown[]
    const list = Array.isArray(value)
      ? value
      : ((value as { data?: unknown }).data ?? (value as { models?: unknown }).models)
    if (!Array.isArray(list)) {
      throw new Error(`无法识别的响应形状: ${JSON.stringify(json).slice(0, 120)}`)
    }
    return list
      .map((raw) => {
        const m = raw as { id?: string; model?: string; owned_by?: string; ownedBy?: string; created?: string | number }
        return {
          id: m.id ?? m.model ?? String(raw),
          ownedBy: m.owned_by ?? m.ownedBy ?? '',
          created: m.created ?? '',
        }
      })
      .sort((a, b) => a.id.localeCompare(b.id))
  }
}

function printTable(models: ModelInfo[]): void {
  console.log('模型 ID'.padEnd(32) + 'owned_by')
  for (const m of models) {
    console.log(m.id.padEnd(32) + (m.ownedBy || '-'))
  }
}

async function main(): Promise<void> {
  const wantJson = process.argv.includes('--json')
  try {
    const { source, models } = await new ModelClient().list()
    if (source === 'fallback') {
      console.error('⚠ 未设置 DEEPSEEK_API_KEY，以下为内置清单（非实时）。')
    }
    if (wantJson) {
      console.log(JSON.stringify(models, null, 2))
    } else {
      printTable(models)
    }
  } catch (err) {
    console.error(`✘ ${err instanceof Error ? err.message : String(err)}`)
    process.exitCode = 1
  }
}

const isMain = process.argv[1]
  && import.meta.url === new URL(process.argv[1], 'file:').href
if (isMain) void main()
