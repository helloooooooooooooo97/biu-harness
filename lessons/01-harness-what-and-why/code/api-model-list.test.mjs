import test from 'node:test';
import assert from 'node:assert/strict';
import { listModels, parseModels } from './api-model-list.mjs';

test('parseModels 归一化 data 数组并排序', () => {
  const models = parseModels({
    data: [
      { id: 'deepseek-reasoner', owned_by: 'deepseek' },
      { id: 'deepseek-chat', owned_by: 'deepseek' },
    ],
  });
  assert.deepEqual(
    models.map((m) => m.id),
    ['deepseek-chat', 'deepseek-reasoner'],
  );
});

test('无 API key 时走内置清单', async () => {
  const { source, models } = await listModels({ apiKey: '' });
  assert.equal(source, 'fallback');
  assert.ok(models.length >= 2);
});

test('有 API key 时走真实接口（fake fetch）', async () => {
  const fakeFetch = async () => ({
    ok: true,
    async json() {
      return { data: [{ id: 'deepseek-chat', owned_by: 'deepseek' }] };
    },
  });
  const { source, models } = await listModels({ apiKey: 'sk-test', fetchImpl: fakeFetch });
  assert.equal(source, 'api');
  assert.equal(models[0].id, 'deepseek-chat');
});

test('API 报错时抛出带状态码的错误', async () => {
  const fakeFetch = async () => ({
    ok: false,
    status: 401,
    async text() {
      return 'Unauthorized';
    },
  });
  await assert.rejects(
    () => listModels({ apiKey: 'bad', fetchImpl: fakeFetch }),
    /HTTP 401/,
  );
});
