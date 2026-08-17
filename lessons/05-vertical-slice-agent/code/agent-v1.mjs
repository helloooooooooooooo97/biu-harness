#!/usr/bin/env node
/**
 * agent-v1：最小 agent loop（输入 → 模型请求 → 回复）。
 *
 * 用法：
 *   DEEPSEEK_API_KEY=sk-... node agent-v1.mjs --prompt "你好"
 *   MOCK_LLM=1 node agent-v1.mjs --prompt "你好"      # 无 key 演示
 *   echo "你好" | node agent-v1.mjs
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

/** 调一次 chat/completions，返回助手消息文本。 */
export async function chat({
  apiKey,
  baseUrl = DEEPSEEK_BASE_URL,
  model = 'deepseek-chat',
  messages,
  fetchImpl = fetch,
  signal,
} = {}) {
  const key = apiKey ?? process.env.DEEPSEEK_API_KEY ?? '';
  if (!key) {
    if (process.env.MOCK_LLM === '1') {
      return `[mock] 我是内置 mock 回复。你说的是：${String(messages.at(-1)?.content ?? '').slice(0, 60)}`;
    }
    throw new Error('缺少 DEEPSEEK_API_KEY。设置环境变量，或使用 MOCK_LLM=1 走内置 mock。');
  }

  const res = await fetchImpl(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model, messages, stream: false }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

/** 跑一个最小回合：user prompt → 模型回复。返回完整 messages 与 reply。 */
export async function runAgent({
  prompt,
  apiKey,
  baseUrl,
  model,
  history = [],
  fetchImpl,
  signal,
} = {}) {
  const messages = [...history, { role: 'user', content: prompt }];
  const reply = await chat({ apiKey, baseUrl, model, messages, fetchImpl, signal });
  return { messages: [...messages, { role: 'assistant', content: reply }], reply };
}

function parseArgs(argv) {
  const args = { prompt: '', history: [] };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--prompt') args.prompt = argv[i + 1];
    else if (argv[i] === '--model') args.model = argv[i + 1];
    else if (argv[i] === '--history') {
      args.history = JSON.parse(readFileSync(argv[i + 1], 'utf8'));
    }
  }
  return args;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const prompt = args.prompt || (await readStdin()).trim();
  if (!prompt) {
    console.error('用法: node agent-v1.mjs --prompt "你好"（或从 stdin 传入）');
    process.exit(1);
  }
  runAgent({ prompt, model: args.model, history: args.history })
    .then(({ reply }) => console.log(reply))
    .catch((err) => {
      console.error(`✘ ${err.message}`);
      process.exitCode = 1;
    });
}

function readStdin() {
  return new Promise((resolvePromise) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolvePromise(data));
  });
}
