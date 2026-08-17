import test from 'node:test';
import assert from 'node:assert/strict';
import { chat, runAgent } from './agent-v1.mjs';

function fakeFetch(response, { status = 200 } = {}) {
  return async () => ({
    ok: status >= 200 && status < 400,
    status,
    async json() {
      return response;
    },
    async text() {
      return JSON.stringify(response);
    },
  });
}

test('runAgent 返回 reply 并追加 assistant 消息', async () => {
  const fetchImpl = fakeFetch({
    choices: [{ message: { role: 'assistant', content: '你好，我是 DeepSeek。' } }],
  });
  const out = await runAgent({ apiKey: 'sk-test', prompt: '你好', fetchImpl });
  assert.equal(out.reply, '你好，我是 DeepSeek。');
  assert.equal(out.messages.length, 2);
  assert.equal(out.messages[0].role, 'user');
  assert.equal(out.messages[1].role, 'assistant');
});

test('请求体包含 model 与完整 messages', async () => {
  let captured;
  const fetchImpl = async (url, init) => {
    captured = { url, init };
    return fakeFetch({ choices: [{ message: { content: 'ok' } }] })();
  };
  await runAgent({
    apiKey: 'sk-test',
    prompt: 'hi',
    history: [{ role: 'assistant', content: '之前的回答' }],
    fetchImpl,
  });
  assert.match(captured.url, /\/chat\/completions$/);
  const body = JSON.parse(captured.init.body);
  assert.equal(body.model, 'deepseek-chat');
  assert.equal(body.messages.length, 2);
  assert.equal(body.messages[0].role, 'assistant');
  assert.equal(body.messages[1].role, 'user');
});

test('缺少 key 且未开 mock 时报错', async () => {
  const oldKey = process.env.DEEPSEEK_API_KEY;
  const oldMock = process.env.MOCK_LLM;
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.MOCK_LLM;
  try {
    await assert.rejects(() => chat({ messages: [{ role: 'user', content: 'hi' }] }), /DEEPSEEK_API_KEY/);
  } finally {
    if (oldKey) process.env.DEEPSEEK_API_KEY = oldKey;
    if (oldMock) process.env.MOCK_LLM = oldMock;
  }
});

test('MOCK_LLM=1 时无 key 也能返回 mock 回复', async () => {
  const oldKey = process.env.DEEPSEEK_API_KEY;
  const oldMock = process.env.MOCK_LLM;
  delete process.env.DEEPSEEK_API_KEY;
  process.env.MOCK_LLM = '1';
  try {
    const reply = await chat({ messages: [{ role: 'user', content: '你好' }] });
    assert.match(reply, /mock/);
  } finally {
    if (oldKey) process.env.DEEPSEEK_API_KEY = oldKey;
    if (oldMock) process.env.MOCK_LLM = oldMock;
    else delete process.env.MOCK_LLM;
  }
});

test('API 4xx 抛出带状态码的错误', async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 401,
    async text() {
      return 'Invalid API key';
    },
  });
  await assert.rejects(
    () => chat({ apiKey: 'bad', messages: [{ role: 'user', content: 'hi' }], fetchImpl }),
    /HTTP 401/,
  );
});
