import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function withTempDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'scaffold-test-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('scaffold.sh 生成完整 monorepo 骨架', async () => {
  await withTempDir(async (tmp) => {
    await execFileAsync('bash', ['scaffold.sh', '--dir', join(tmp, 'project')]);
    const root = join(tmp, 'project');
    for (const rel of [
      'package.json',
      'pnpm-workspace.yaml',
      'tsconfig.base.json',
      'packages/core-session/src/index.ts',
      'packages/llm-deepseek/src/index.ts',
      'packages/tool-bash/src/index.ts',
      'apps/cli/src/index.ts',
    ]) {
      await assert.doesNotReject(stat(join(root, rel)), `缺少 ${rel}`);
    }
  });
});

test('scaffold.sh --dry-run 不落盘', async () => {
  await withTempDir(async (tmp) => {
    const out = await execFileAsync('bash', ['scaffold.sh', '--dir', join(tmp, 'dry'), '--dry-run']);
    assert.match(out.stdout, /core-session\/\{package\.json/);
    await assert.rejects(stat(join(tmp, 'dry')));
  });
});

test('scaffold.sh 拒绝覆盖非空目录', async () => {
  await withTempDir(async (tmp) => {
    const occupied = join(tmp, 'occupied');
    await mkdir(occupied);
    await writeFile(join(occupied, 'keep.txt'), 'x');
    await assert.rejects(
      execFileAsync('bash', ['scaffold.sh', '--dir', join(tmp, 'occupied')]),
      (err) => err.stderr?.includes('目录非空'),
    );
  });
});
