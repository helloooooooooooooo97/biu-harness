export type ChatProvider = 'deepseek' | 'openai' | 'anthropic'

export const CHAT_PROVIDERS: ChatProvider[] = ['deepseek', 'openai', 'anthropic']

export interface LlmModelDef {
  id: string
  /** 展示名（如「DeepSeek Flash」） */
  label: string
  provider: ChatProvider
  /** 传给上游 API 的 model id */
  model: string
  category: 'flash' | 'pro' | 'claude' | 'gpt' | 'other'
  note?: string
}

/** 模型目录：deepseek(flash/pro)、claude、gpt；每项归属 provider，只有对应 provider 配了 token 才可选。 */
export const LLM_MODEL_CATALOG: LlmModelDef[] = [
  // DeepSeek（OpenAI 兼容，endpoint https://api.deepseek.com/chat/completions）
  { id: 'deepseek-flash', label: 'DeepSeek Flash', provider: 'deepseek', model: 'deepseek-chat', category: 'flash', note: '通用对话 / 快速' },
  { id: 'deepseek-pro', label: 'DeepSeek Pro', provider: 'deepseek', model: 'deepseek-reasoner', category: 'pro', note: '深度推理' },
  // Anthropic Claude（endpoint https://api.anthropic.com/v1/messages）
  { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', category: 'claude', note: '智能均衡' },
  { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku', provider: 'anthropic', model: 'claude-3-5-haiku-20241022', category: 'claude', note: '轻量快速' },
  // OpenAI GPT
  { id: 'gpt-4o', label: 'GPT-4o', provider: 'openai', model: 'gpt-4o', category: 'gpt', note: '通用旗舰' },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini', provider: 'openai', model: 'gpt-4o-mini', category: 'gpt', note: '轻量快速' },
]

export function describeProvider(provider: ChatProvider): string {
  switch (provider) {
    case 'deepseek':
      return 'DeepSeek'
    case 'openai':
      return 'OpenAI'
    case 'anthropic':
      return 'Anthropic'
    default:
      return provider
  }
}

export function defaultModelFor(provider: ChatProvider): string {
  const first = LLM_MODEL_CATALOG.find((m) => m.provider === provider)
  return first?.model ?? 'deepseek-chat'
}
