#!/usr/bin/env node
/**
 * 会话日志解析器：JSONL 事件流 → 统计 / CSV / JSON。
 *
 * 用法：
 *   node trace-parser.mjs sample-session.jsonl --summary
 *   node trace-parser.mjs sample-session.jsonl --csv
 *   node trace-parser.mjs sample-session.jsonl --json
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 解析 JSONL 文本，逐行容错（坏行标记为 unparsed，不中断）。 */
export function parseLog(text) {
  const events = [];
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    if (!raw.trim()) continue;
    try {
      events.push({ ...JSON.parse(raw), line: index + 1 });
    } catch (err) {
      events.push({
        line: index + 1,
        kind: 'unparsed',
        time: '',
        data: { raw: raw.slice(0, 120) },
        error: String(err),
      });
    }
  }
  return events;
}

const USAGE_ALIASES = [
  ['promptTokens', 'prompt_tokens'],
  ['completionTokens', 'completion_tokens'],
  ['totalTokens', 'total_tokens'],
];

function usageOf(data = {}) {
  const usage = data.usage ?? {};
  const out = {};
  for (const [a, b] of USAGE_ALIASES) {
    if (usage[a] != null || usage[b] != null) out[a] = usage[a] ?? usage[b];
  }
  return out;
}

function textOf(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .filter(Boolean)
      .join(' ');
  }
  return '';
}

/** 汇总统计：turn/step/消息/工具/token。 */
export function summarize(events) {
  const s = {
    turns: 0,
    steps: 0,
    userMessages: 0,
    assistantMessages: 0,
    assistantChunks: 0,
    toolCalls: 0,
    toolResults: 0,
    unparsed: 0,
    token: { prompt: 0, completion: 0, total: 0 },
  };
  for (const ev of events) {
    switch (ev.kind) {
      case 'turn/start': s.turns += 1; break;
      case 'step/start': s.steps += 1; break;
      case 'user/message': s.userMessages += 1; break;
      case 'assistant/chunk': s.assistantChunks += 1; break;
      case 'assistant/message': {
        s.assistantMessages += 1;
        const t = usageOf(ev.data);
        s.token.prompt += t.promptTokens ?? 0;
        s.token.completion += t.completionTokens ?? 0;
        s.token.total += t.totalTokens ?? 0;
        break;
      }
      case 'tool/call': s.toolCalls += 1; break;
      case 'tool/result': s.toolResults += 1; break;
      case 'unparsed': s.unparsed += 1; break;
    }
  }
  return s;
}

function detailOf(ev) {
  const d = ev.data ?? {};
  switch (ev.kind) {
    case 'user/message':
      return String(d.content ?? '').slice(0, 80);
    case 'assistant/chunk':
      return String(d.chunk?.text ?? JSON.stringify(d.chunk ?? '')).slice(0, 80);
    case 'assistant/message': {
      const text = textOf(d.message?.content);
      return (text || JSON.stringify(d.message ?? '')).slice(0, 80);
    }
    case 'tool/call':
      return `${d.name}(${String(d.arguments ?? '').slice(0, 60)})`;
    case 'tool/result': {
      const text = textOf(d.message?.content);
      return `${text.slice(0, 60)}${d.message?.isError ? ' [error]' : ''}`;
    }
    default:
      return '';
  }
}

/** 拍平成行，供 CSV/JSON 使用。 */
export function rows(events) {
  return events.map((ev) => ({
    line: ev.line,
    time: ev.time ?? '',
    kind: ev.kind ?? 'unparsed',
    turn: ev.data?.turn ?? '',
    step: ev.data?.step ?? '',
    detail: detailOf(ev),
  }));
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rowList) {
  const header = ['line', 'time', 'kind', 'turn', 'step', 'detail'];
  const lines = [header.join(',')];
  for (const r of rowList) {
    lines.push(header.map((k) => csvEscape(r[k])).join(','));
  }
  return lines.join('\n');
}

export function toJson(rowList) {
  return JSON.stringify(rowList, null, 2);
}

function main() {
  const [file, flag] = process.argv.slice(2);
  if (!file) {
    console.error('用法: node trace-parser.mjs <file.jsonl> [--summary|--csv|--json]');
    process.exit(1);
  }
  const events = parseLog(readFileSync(file, 'utf8'));
  const format = flag === '--csv' || flag === '--json' ? flag : '--summary';

  if (format === '--summary') {
    console.log(JSON.stringify(summarize(events), null, 2));
    return;
  }
  const rowList = rows(events);
  console.log(format === '--csv' ? toCsv(rowList) : toJson(rowList));
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) main();
