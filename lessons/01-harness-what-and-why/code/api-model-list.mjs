#!/usr/bin/env node
/**
 * 列出 DeepSeek 可用模型的小脚本。
 *
 * 用法：
 *   node api-model-list.mjs                     # 有 key 走 API，无 key 输出内置清单
 *   DEEPSEEK_API_KEY=sk-... node api-model-list.mjs
 *   node api-model-list.mjs --json              # 输出 JSON
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
const API_KEY = process.env.DEEPSEEK_API_KEY;

// 内置清单：真实接口不可用时兜底，也是学习期的参考。
const FALLBACK_MODELS = ['deepseek-chat', 'deepseek-reasoner'];

/** 把任意响应形状归一化成模型行。兼容 { data: [...] } / { models: [...] } / 数组。 */
export function parseModels(json) {
  const list = Array.isArray(json) ? json : (json.data ?? json.models ?? []);
  if (!Array.isArray(list)) {
    throw new Error(`无法识别的响应形状: ${JSON.stringify(json).slice(0, 120)}`);
  }
  return list
    .map((m) => ({
      id: m.id ?? m.model ?? String(m),
      ownedBy: m.owned_by ?? m.ownedBy ?? '',
      created: m.created ?? '',
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** 列出模型：有 key 走 GET /models，无 key 走内置清单。 */
export async function listModels({
  apiKey = API_KEY,
  baseUrl = DEEPSEEK_BASE_URL,
  fetchImpl = fetch,
} = {}) {
  if (!apiKey) {
    return { source: 'fallback', models: parseModels(FALLBACK_MODELS) };
  }
  const res = await fetchImpl(`${baseUrl}/models`, {
    headers: { authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return { source: 'api', models: parseModels(await res.json()) };
}

function printTable(models) {
  console.log('模型 ID'.padEnd(32) + 'owned_by');
  for (const m of models) {
    console.log(m.id.padEnd(32) + (m.ownedBy || '-'));
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  const wantJson = process.argv.includes('--json');
  listModels()
    .then(({ source, models }) => {
      if (source === 'fallback') {
        console.error('⚠ 未设置 DEEPSEEK_API_KEY，以下为内置清单（非实时）。');
      }
      if (wantJson) {
        console.log(JSON.stringify(models, null, 2));
      } else {
        printTable(models);
      }
    })
    .catch((err) => {
      console.error(`✘ ${err.message}`);
      process.exitCode = 1;
    });
}
