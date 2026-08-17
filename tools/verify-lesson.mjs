#!/usr/bin/env node
/**
 * 验收脚本：检查课程文件齐备，并尝试运行 code/ 下的测试。
 * 用法：
 *   node tools/verify-lesson.mjs lessons/05-vertical-slice-agent
 *   node tools/verify-lesson.mjs 05
 */
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

function fail(msg) {
  console.error(`✘ ${msg}`);
  process.exitCode = 1;
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('用法: node tools/verify-lesson.mjs <lesson-dir|课号>');
    process.exit(1);
  }

  const dir = /^\d+$/.test(arg)
    ? join(ROOT, 'lessons', arg.padStart(2, '0') + '-*')
    : join(ROOT, arg);

  // 课号形式：解析实际目录
  let lessonDir = dir;
  if (dir.includes('*')) {
    const { readdir } = await import('node:fs/promises');
    const lessons = await readdir(join(ROOT, 'lessons'));
    const match = lessons.find((d) => d.startsWith(arg.padStart(2, '0') + '-'));
    if (!match) return fail(`找不到课 ${arg}`);
    lessonDir = join(ROOT, 'lessons', match);
  }

  const required = ['README.md', 'lecture.md', 'homework.md', 'code'];
  for (const name of required) {
    if (!existsSync(join(lessonDir, name))) {
      fail(`${lessonDir}/${name} 缺失`);
    }
  }
  if (process.exitCode) return;
  console.log(`✔ 文件齐备: ${lessonDir}`);

  const codeDir = join(lessonDir, 'code');
  const pkg = join(codeDir, 'package.json');
  if (!existsSync(pkg)) {
    console.log('ℹ 本课尚无 package.json，跳过测试。');
    return;
  }
  const pkgJson = JSON.parse(await readFile(pkg, 'utf8'));
  if (!pkgJson.scripts?.test) {
    console.log('ℹ 本课未定义 test script，跳过测试。');
    return;
  }

  await new Promise((resolvePromise) => {
    const child = spawn('npm', ['test'], { cwd: codeDir, stdio: 'inherit' });
    child.on('exit', (code) => {
      if (code !== 0) fail(`${lessonDir}/code 测试失败`);
      resolvePromise();
    });
  });
  if (!process.exitCode) console.log(`✔ 测试通过: ${lessonDir}`);
}

main();
