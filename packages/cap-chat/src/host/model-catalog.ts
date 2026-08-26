/**
 * 模型入口目录：官方 API + 常见中转站 / 聚合网关 + 本地运行时。
 * 同一入口（endpoint）共用一把 Key、一个 baseUrl，下面可挂多个模型名（统一入口多模型）。
 */

export type ChatProvider = 'deepseek' | 'openai' | 'anthropic'

/** 请求协议：决定走 OpenAI 兼容 chat.completions 还是 Anthropic messages。 */
export type LlmProtocol = 'openai-compat' | 'anthropic'

export type EndpointGroup = 'official' | 'relay' | 'local' | 'custom'

export interface LlmEndpointDef {
  id: string
  label: string
  group: EndpointGroup
  protocol: LlmProtocol
  /**
   * API 根地址（不含 /chat/completions 或 /messages）。
   * openai-compat 示例：https://api.openai.com/v1
   * anthropic 示例：https://api.anthropic.com/v1
   */
  baseUrl: string
  /**
   * 映射到现有 LLM 客户端分流：
   * - deepseek：OpenAI 兼容 + 视觉模型自动路由
   * - openai：OpenAI 兼容
   * - anthropic：Anthropic Messages
   */
  provider: ChatProvider
  placeholder?: string
  note?: string
  /** 是否内置（不可删除；baseUrl 可被用户覆盖） */
  builtin?: boolean
}

export interface LlmModelDef {
  id: string
  /** 展示名 */
  label: string
  /** 所属入口 id（官方 / 中转站 / 自定义） */
  endpointId: string
  /**
   * 兼容旧语义：与所属入口的 provider 一致（deepseek | openai | anthropic）。
   * 会话 / composer 仍用它做协议分流；真正发请求时用 endpoint.baseUrl。
   */
  provider: ChatProvider
  /** 传给上游 API 的 model id */
  model: string
  category: string
  note?: string
  builtin?: boolean
}

/** 内置入口：官方 + 常见中转站 / 聚合 + 本地。越全越好，URL 可按需在 UI 覆盖。 */
export const LLM_ENDPOINT_PRESETS: LlmEndpointDef[] = [
  // ── 官方 ──
  {
    id: 'deepseek',
    label: 'DeepSeek',
    group: 'official',
    protocol: 'openai-compat',
    baseUrl: 'https://api.deepseek.com',
    provider: 'deepseek',
    placeholder: 'sk-…',
    note: '官方 · OpenAI 兼容',
    builtin: true,
  },
  {
    id: 'openai',
    label: 'OpenAI',
    group: 'official',
    protocol: 'openai-compat',
    baseUrl: 'https://api.openai.com/v1',
    provider: 'openai',
    placeholder: 'sk-…',
    note: '官方 · GPT',
    builtin: true,
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    group: 'official',
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    provider: 'anthropic',
    placeholder: 'sk-ant-…',
    note: '官方 · Claude Messages',
    builtin: true,
  },
  {
    id: 'moonshot',
    label: 'Moonshot（Kimi）',
    group: 'official',
    protocol: 'openai-compat',
    baseUrl: 'https://api.moonshot.cn/v1',
    provider: 'openai',
    placeholder: 'sk-…',
    note: '月之暗面官方',
    builtin: true,
  },
  {
    id: 'zhipu',
    label: '智谱 GLM',
    group: 'official',
    protocol: 'openai-compat',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    provider: 'openai',
    placeholder: '…',
    note: '智谱 AI 官方',
    builtin: true,
  },
  {
    id: 'dashscope',
    label: '通义千问（DashScope）',
    group: 'official',
    protocol: 'openai-compat',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    provider: 'openai',
    placeholder: 'sk-…',
    note: '阿里云兼容模式',
    builtin: true,
  },
  {
    id: 'qianfan',
    label: '百度千帆',
    group: 'official',
    protocol: 'openai-compat',
    baseUrl: 'https://qianfan.baidubce.com/v2',
    provider: 'openai',
    placeholder: 'bce-v3/…',
    note: '文心 / 千帆 OpenAI 兼容',
    builtin: true,
  },
  {
    id: 'volcengine',
    label: '火山方舟（豆包）',
    group: 'official',
    protocol: 'openai-compat',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    provider: 'openai',
    placeholder: '…',
    note: '字节跳动方舟',
    builtin: true,
  },
  {
    id: 'minimax',
    label: 'MiniMax',
    group: 'official',
    protocol: 'openai-compat',
    baseUrl: 'https://api.minimax.chat/v1',
    provider: 'openai',
    placeholder: '…',
    note: 'MiniMax 官方',
    builtin: true,
  },
  {
    id: 'yi',
    label: '零一万物 Yi',
    group: 'official',
    protocol: 'openai-compat',
    baseUrl: 'https://api.lingyiwanwu.com/v1',
    provider: 'openai',
    placeholder: '…',
    note: 'Yi 官方',
    builtin: true,
  },
  {
    id: 'stepfun',
    label: '阶跃星辰 StepFun',
    group: 'official',
    protocol: 'openai-compat',
    baseUrl: 'https://api.stepfun.com/v1',
    provider: 'openai',
    placeholder: '…',
    note: 'Step 系列',
    builtin: true,
  },
  {
    id: 'baichuan',
    label: '百川 Baichuan',
    group: 'official',
    protocol: 'openai-compat',
    baseUrl: 'https://api.baichuan-ai.com/v1',
    provider: 'openai',
    placeholder: '…',
    note: '百川智能',
    builtin: true,
  },
  {
    id: 'siliconflow',
    label: '硅基流动 SiliconFlow',
    group: 'official',
    protocol: 'openai-compat',
    baseUrl: 'https://api.siliconflow.cn/v1',
    provider: 'openai',
    placeholder: 'sk-…',
    note: '聚合多模型 · 国内常用',
    builtin: true,
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    group: 'official',
    protocol: 'openai-compat',
    baseUrl: 'https://openrouter.ai/api/v1',
    provider: 'openai',
    placeholder: 'sk-or-…',
    note: '全球模型聚合',
    builtin: true,
  },
  {
    id: 'groq',
    label: 'Groq',
    group: 'official',
    protocol: 'openai-compat',
    baseUrl: 'https://api.groq.com/openai/v1',
    provider: 'openai',
    placeholder: 'gsk_…',
    note: '高速推理',
    builtin: true,
  },
  {
    id: 'together',
    label: 'Together AI',
    group: 'official',
    protocol: 'openai-compat',
    baseUrl: 'https://api.together.xyz/v1',
    provider: 'openai',
    placeholder: '…',
    note: '开源模型托管',
    builtin: true,
  },
  {
    id: 'fireworks',
    label: 'Fireworks AI',
    group: 'official',
    protocol: 'openai-compat',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    provider: 'openai',
    placeholder: '…',
    note: '开源模型推理',
    builtin: true,
  },
  {
    id: 'deepinfra',
    label: 'DeepInfra',
    group: 'official',
    protocol: 'openai-compat',
    baseUrl: 'https://api.deepinfra.com/v1/openai',
    provider: 'openai',
    placeholder: '…',
    note: '开源模型',
    builtin: true,
  },
  {
    id: 'mistral',
    label: 'Mistral',
    group: 'official',
    protocol: 'openai-compat',
    baseUrl: 'https://api.mistral.ai/v1',
    provider: 'openai',
    placeholder: '…',
    note: 'Mistral 官方',
    builtin: true,
  },
  {
    id: 'xai',
    label: 'xAI Grok',
    group: 'official',
    protocol: 'openai-compat',
    baseUrl: 'https://api.x.ai/v1',
    provider: 'openai',
    placeholder: 'xai-…',
    note: 'Grok 官方',
    builtin: true,
  },
  {
    id: 'gemini-openai',
    label: 'Google Gemini（OpenAI 兼容）',
    group: 'official',
    protocol: 'openai-compat',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    provider: 'openai',
    placeholder: 'AIza…',
    note: 'Gemini OpenAI 兼容层',
    builtin: true,
  },
  {
    id: 'nvidia',
    label: 'NVIDIA NIM',
    group: 'official',
    protocol: 'openai-compat',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    provider: 'openai',
    placeholder: 'nvapi-…',
    note: 'NVIDIA 托管推理',
    builtin: true,
  },

  // ── 中转站 / 国内常见代理（统一 OpenAI 兼容入口，一把 Key 多模型）──
  {
    id: 'closeai',
    label: 'CloseAI',
    group: 'relay',
    protocol: 'openai-compat',
    baseUrl: 'https://api.closeai-asia.com/v1',
    provider: 'openai',
    placeholder: 'sk-…',
    note: '中转站 · GPT/Claude/Gemini 等',
    builtin: true,
  },
  {
    id: 'api2d',
    label: 'API2D',
    group: 'relay',
    protocol: 'openai-compat',
    baseUrl: 'https://oa.api2d.net/v1',
    provider: 'openai',
    placeholder: 'fk…',
    note: '中转站',
    builtin: true,
  },
  {
    id: 'ohmygpt',
    label: 'OhMyGPT',
    group: 'relay',
    protocol: 'openai-compat',
    baseUrl: 'https://api.ohmygpt.com/v1',
    provider: 'openai',
    placeholder: '…',
    note: '中转站',
    builtin: true,
  },
  {
    id: 'chatanywhere',
    label: 'ChatAnywhere',
    group: 'relay',
    protocol: 'openai-compat',
    baseUrl: 'https://api.chatanywhere.tech/v1',
    provider: 'openai',
    placeholder: 'sk-…',
    note: '中转站 · 国内直连',
    builtin: true,
  },
  {
    id: 'openai-sb',
    label: 'OpenAI-SB',
    group: 'relay',
    protocol: 'openai-compat',
    baseUrl: 'https://api.openai-sb.com/v1',
    provider: 'openai',
    placeholder: 'sb-…',
    note: '中转站',
    builtin: true,
  },
  {
    id: 'aiproxy',
    label: 'AIProxy',
    group: 'relay',
    protocol: 'openai-compat',
    baseUrl: 'https://api.aiproxy.io/v1',
    provider: 'openai',
    placeholder: 'sk-…',
    note: '中转站',
    builtin: true,
  },
  {
    id: 'poloapi',
    label: 'PoloAPI',
    group: 'relay',
    protocol: 'openai-compat',
    baseUrl: 'https://api.poloapi.com/v1',
    provider: 'openai',
    placeholder: 'sk-…',
    note: '中转站',
    builtin: true,
  },
  {
    id: 'yunwu',
    label: '云雾 Yunwu',
    group: 'relay',
    protocol: 'openai-compat',
    baseUrl: 'https://api.yunwu.ai/v1',
    provider: 'openai',
    placeholder: 'sk-…',
    note: '中转站 · 多模型',
    builtin: true,
  },
  {
    id: 'apiyi',
    label: 'API易',
    group: 'relay',
    protocol: 'openai-compat',
    baseUrl: 'https://api.apiyi.com/v1',
    provider: 'openai',
    placeholder: 'sk-…',
    note: '中转站',
    builtin: true,
  },
  {
    id: 'gptgod',
    label: 'GPTGod',
    group: 'relay',
    protocol: 'openai-compat',
    baseUrl: 'https://api.gptgod.online/v1',
    provider: 'openai',
    placeholder: '…',
    note: '中转站',
    builtin: true,
  },
  {
    id: 'aihubmix',
    label: 'AiHubMix',
    group: 'relay',
    protocol: 'openai-compat',
    baseUrl: 'https://aihubmix.com/v1',
    provider: 'openai',
    placeholder: 'sk-…',
    note: '中转站 · 聚合',
    builtin: true,
  },
  {
    id: 'opencs',
    label: 'OpenCS / OneAPI 风格',
    group: 'relay',
    protocol: 'openai-compat',
    baseUrl: 'https://api.openai.com/v1',
    provider: 'openai',
    placeholder: 'sk-…',
    note: '自建 OneAPI/NewAPI 时请改 URL',
    builtin: true,
  },
  {
    id: 'relay-claude-compat',
    label: 'Claude 中转（OpenAI 兼容）',
    group: 'relay',
    protocol: 'openai-compat',
    baseUrl: 'https://api.closeai-asia.com/v1',
    provider: 'openai',
    placeholder: 'sk-…',
    note: '多数中转站用 OpenAI 格式调 Claude',
    builtin: true,
  },

  // ── 本地 ──
  {
    id: 'ollama',
    label: 'Ollama',
    group: 'local',
    protocol: 'openai-compat',
    baseUrl: 'http://127.0.0.1:11434/v1',
    provider: 'openai',
    placeholder: 'ollama（可空）',
    note: '本地 · ollama serve',
    builtin: true,
  },
  {
    id: 'lmstudio',
    label: 'LM Studio',
    group: 'local',
    protocol: 'openai-compat',
    baseUrl: 'http://127.0.0.1:1234/v1',
    provider: 'openai',
    placeholder: 'lm-studio（可空）',
    note: '本地 · LM Studio Server',
    builtin: true,
  },
  {
    id: 'vllm',
    label: 'vLLM',
    group: 'local',
    protocol: 'openai-compat',
    baseUrl: 'http://127.0.0.1:8000/v1',
    provider: 'openai',
    placeholder: '（可空）',
    note: '本地 / 自建 vLLM',
    builtin: true,
  },
]

/** 旧三家 + 各入口常见默认模型；中转站只给代表性模型名，用户可自行追加。 */
export const LLM_MODEL_CATALOG: LlmModelDef[] = [
  // DeepSeek
  { id: 'deepseek-flash', label: 'DeepSeek Flash', endpointId: 'deepseek', provider: 'deepseek', model: 'deepseek-v4-flash', category: 'flash', note: '通用对话 / 快速', builtin: true },
  { id: 'deepseek-pro', label: 'DeepSeek Pro', endpointId: 'deepseek', provider: 'deepseek', model: 'deepseek-v4-pro', category: 'pro', note: '深度推理', builtin: true },
  { id: 'deepseek-flash-vision', label: 'DeepSeek Flash Vision', endpointId: 'deepseek', provider: 'deepseek', model: 'deepseek-v4-flash-vision-exp', category: 'flash', note: '多模态视觉', builtin: true },
  { id: 'deepseek-chat', label: 'DeepSeek Chat', endpointId: 'deepseek', provider: 'deepseek', model: 'deepseek-chat', category: 'flash', note: '经典对话', builtin: true },
  { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner', endpointId: 'deepseek', provider: 'deepseek', model: 'deepseek-reasoner', category: 'pro', note: 'R1 推理', builtin: true },

  // OpenAI
  { id: 'gpt-4o', label: 'GPT-4o', endpointId: 'openai', provider: 'openai', model: 'gpt-4o', category: 'gpt', note: '通用旗舰', builtin: true },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini', endpointId: 'openai', provider: 'openai', model: 'gpt-4o-mini', category: 'gpt', note: '轻量快速', builtin: true },
  { id: 'gpt-4.1', label: 'GPT-4.1', endpointId: 'openai', provider: 'openai', model: 'gpt-4.1', category: 'gpt', note: '编码增强', builtin: true },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini', endpointId: 'openai', provider: 'openai', model: 'gpt-4.1-mini', category: 'gpt', note: '轻量', builtin: true },
  { id: 'o3-mini', label: 'o3-mini', endpointId: 'openai', provider: 'openai', model: 'o3-mini', category: 'gpt', note: '推理', builtin: true },
  { id: 'o4-mini', label: 'o4-mini', endpointId: 'openai', provider: 'openai', model: 'o4-mini', category: 'gpt', note: '推理', builtin: true },

  // Anthropic
  { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', endpointId: 'anthropic', provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', category: 'claude', note: '智能均衡', builtin: true },
  { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku', endpointId: 'anthropic', provider: 'anthropic', model: 'claude-3-5-haiku-20241022', category: 'claude', note: '轻量快速', builtin: true },
  { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', endpointId: 'anthropic', provider: 'anthropic', model: 'claude-sonnet-4-20250514', category: 'claude', note: '新一代', builtin: true },
  { id: 'claude-opus-4-20250514', label: 'Claude Opus 4', endpointId: 'anthropic', provider: 'anthropic', model: 'claude-opus-4-20250514', category: 'claude', note: '旗舰', builtin: true },

  // Moonshot
  { id: 'moonshot-v1-auto', label: 'Kimi', endpointId: 'moonshot', provider: 'openai', model: 'moonshot-v1-auto', category: 'other', note: '自动路由', builtin: true },
  { id: 'kimi-k2', label: 'Kimi K2', endpointId: 'moonshot', provider: 'openai', model: 'kimi-k2-0711-preview', category: 'other', note: 'K2', builtin: true },

  // 智谱
  { id: 'glm-4-plus', label: 'GLM-4-Plus', endpointId: 'zhipu', provider: 'openai', model: 'glm-4-plus', category: 'other', builtin: true },
  { id: 'glm-4-flash', label: 'GLM-4-Flash', endpointId: 'zhipu', provider: 'openai', model: 'glm-4-flash', category: 'other', note: '免费高速', builtin: true },
  { id: 'glm-z1-air', label: 'GLM-Z1-Air', endpointId: 'zhipu', provider: 'openai', model: 'glm-z1-air', category: 'other', note: '推理', builtin: true },

  // 通义
  { id: 'qwen-max', label: 'Qwen-Max', endpointId: 'dashscope', provider: 'openai', model: 'qwen-max', category: 'other', builtin: true },
  { id: 'qwen-plus', label: 'Qwen-Plus', endpointId: 'dashscope', provider: 'openai', model: 'qwen-plus', category: 'other', builtin: true },
  { id: 'qwen-turbo', label: 'Qwen-Turbo', endpointId: 'dashscope', provider: 'openai', model: 'qwen-turbo', category: 'other', builtin: true },
  { id: 'qwq-plus', label: 'QwQ-Plus', endpointId: 'dashscope', provider: 'openai', model: 'qwq-plus', category: 'other', note: '推理', builtin: true },

  // 硅基流动（统一入口多模型示例）
  { id: 'sf-deepseek-v3', label: 'DeepSeek-V3', endpointId: 'siliconflow', provider: 'openai', model: 'deepseek-ai/DeepSeek-V3', category: 'other', note: '硅基流动', builtin: true },
  { id: 'sf-deepseek-r1', label: 'DeepSeek-R1', endpointId: 'siliconflow', provider: 'openai', model: 'deepseek-ai/DeepSeek-R1', category: 'other', note: '硅基流动', builtin: true },
  { id: 'sf-qwen3-235b', label: 'Qwen3-235B', endpointId: 'siliconflow', provider: 'openai', model: 'Qwen/Qwen3-235B-A22B', category: 'other', note: '硅基流动', builtin: true },

  // OpenRouter（统一入口）
  { id: 'or-gpt-4o', label: 'GPT-4o', endpointId: 'openrouter', provider: 'openai', model: 'openai/gpt-4o', category: 'other', note: 'OpenRouter', builtin: true },
  { id: 'or-claude-sonnet', label: 'Claude Sonnet', endpointId: 'openrouter', provider: 'openai', model: 'anthropic/claude-sonnet-4', category: 'other', note: 'OpenRouter', builtin: true },
  { id: 'or-gemini-pro', label: 'Gemini Pro', endpointId: 'openrouter', provider: 'openai', model: 'google/gemini-2.5-pro', category: 'other', note: 'OpenRouter', builtin: true },

  // Groq
  { id: 'groq-llama-70b', label: 'Llama 3.3 70B', endpointId: 'groq', provider: 'openai', model: 'llama-3.3-70b-versatile', category: 'other', builtin: true },
  { id: 'groq-qwen3-32b', label: 'Qwen3 32B', endpointId: 'groq', provider: 'openai', model: 'qwen/qwen3-32b', category: 'other', builtin: true },

  // xAI
  { id: 'grok-3', label: 'Grok 3', endpointId: 'xai', provider: 'openai', model: 'grok-3', category: 'other', builtin: true },
  { id: 'grok-3-mini', label: 'Grok 3 Mini', endpointId: 'xai', provider: 'openai', model: 'grok-3-mini', category: 'other', builtin: true },

  // Gemini OpenAI compat
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', endpointId: 'gemini-openai', provider: 'openai', model: 'gemini-2.5-pro', category: 'other', builtin: true },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', endpointId: 'gemini-openai', provider: 'openai', model: 'gemini-2.5-flash', category: 'other', builtin: true },

  // 中转站：同一入口挂多模型（名称按站内习惯，可改）
  { id: 'closeai-gpt-4o', label: 'GPT-4o', endpointId: 'closeai', provider: 'openai', model: 'gpt-4o', category: 'relay', note: 'CloseAI', builtin: true },
  { id: 'closeai-claude', label: 'Claude Sonnet', endpointId: 'closeai', provider: 'openai', model: 'claude-sonnet-4-20250514', category: 'relay', note: 'CloseAI · OpenAI 格式', builtin: true },
  { id: 'closeai-gemini', label: 'Gemini', endpointId: 'closeai', provider: 'openai', model: 'gemini-2.5-pro', category: 'relay', note: 'CloseAI', builtin: true },
  { id: 'chatanywhere-gpt-4o', label: 'GPT-4o', endpointId: 'chatanywhere', provider: 'openai', model: 'gpt-4o', category: 'relay', builtin: true },
  { id: 'chatanywhere-gpt-4o-mini', label: 'GPT-4o mini', endpointId: 'chatanywhere', provider: 'openai', model: 'gpt-4o-mini', category: 'relay', builtin: true },
  { id: 'yunwu-gpt-4o', label: 'GPT-4o', endpointId: 'yunwu', provider: 'openai', model: 'gpt-4o', category: 'relay', builtin: true },
  { id: 'yunwu-claude', label: 'Claude', endpointId: 'yunwu', provider: 'openai', model: 'claude-sonnet-4-20250514', category: 'relay', builtin: true },
  { id: 'aihubmix-gpt-4o', label: 'GPT-4o', endpointId: 'aihubmix', provider: 'openai', model: 'gpt-4o', category: 'relay', builtin: true },
  { id: 'aihubmix-claude', label: 'Claude', endpointId: 'aihubmix', provider: 'openai', model: 'claude-sonnet-4-20250514', category: 'relay', builtin: true },
  { id: 'relay-claude-sonnet', label: 'Claude Sonnet（兼容）', endpointId: 'relay-claude-compat', provider: 'openai', model: 'claude-sonnet-4-20250514', category: 'relay', note: '改 URL 指向你的中转', builtin: true },
  { id: 'relay-claude-opus', label: 'Claude Opus（兼容）', endpointId: 'relay-claude-compat', provider: 'openai', model: 'claude-opus-4-20250514', category: 'relay', note: '改 URL 指向你的中转', builtin: true },

  // 本地
  { id: 'ollama-llama', label: 'llama3.2', endpointId: 'ollama', provider: 'openai', model: 'llama3.2', category: 'local', builtin: true },
  { id: 'ollama-qwen', label: 'qwen2.5', endpointId: 'ollama', provider: 'openai', model: 'qwen2.5', category: 'local', builtin: true },
  { id: 'lmstudio-local', label: '当前加载模型', endpointId: 'lmstudio', provider: 'openai', model: 'local-model', category: 'local', note: '按 LM Studio 实际模型名改', builtin: true },
]

/** 兼容旧代码：仅 deepseek / openai / anthropic。 */
export const CHAT_PROVIDERS: ChatProvider[] = ['deepseek', 'openai', 'anthropic']

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

export function describeEndpointGroup(group: EndpointGroup): string {
  switch (group) {
    case 'official':
      return '官方'
    case 'relay':
      return '中转站'
    case 'local':
      return '本地'
    case 'custom':
      return '自定义'
    default:
      return group
  }
}

export function defaultModelFor(provider: ChatProvider): string {
  const first = LLM_MODEL_CATALOG.find((m) => m.provider === provider)
  return first?.model ?? 'deepseek-v4-flash'
}

export function findEndpointPreset(id: string): LlmEndpointDef | undefined {
  return LLM_ENDPOINT_PRESETS.find((e) => e.id === id)
}

export function endpointProtocolProvider(endpoint: LlmEndpointDef): ChatProvider {
  return endpoint.provider
}

/** 规范化用户输入的 baseUrl（去尾斜杠）。 */
export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}
