#!/usr/bin/env node
/**
 * 一键生成/重建课程骨架。
 * 用法：
 *   node tools/gen-lesson-scaffold.mjs            # 生成全部 50 课
 *   node tools/gen-lesson-scaffold.mjs 05 06 07   # 只生成指定课
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const LESSONS = {
  1: ['harness-what-and-why', 'A', 'Harness 是什么：模型与智能体框架的边界'],
  2: ['run-dsh-first-task', 'A', '安装运行官方 dsh，完成第一个任务'],
  3: ['read-the-trace', 'A', '读懂轨迹页：Turn / Step / 工具调用 / token'],
  4: ['tech-stack-and-roadmap', 'A', '技术栈与课程地图'],
  5: ['vertical-slice-agent', 'B', '单文件 Agent Loop：调 DeepSeek API'],
  6: ['tool-call-loop', 'B', '工具调用循环：tool_call 解析、执行、回填'],
  7: ['streaming-and-stop', 'B', '流式输出与 stop reason'],
  8: ['mock-llm-replay', 'B', 'mock LLM 与录放测试'],
  9: ['session-event-log', 'C', '会话日志：append-only 事件流'],
  10: ['derive-messages', 'C', '从日志重建模型上下文'],
  11: ['event-vocabulary', 'C', '事件类型设计（user/assistant/tool/step/turn）'],
  12: ['replay-and-snapshots', 'C', '重放与 golden transcript 测试'],
  13: ['context-and-plugin', 'D', 'Context 与插件模型'],
  14: ['services-and-inject', 'D', '服务注册 ctx.xxx 与 inject 依赖'],
  15: ['event-dispatch-modes', 'D', '事件四模式：emit/waterfall/parallel/serial'],
  16: ['effects-and-teardown', 'D', 'effect 与可逆注册（卸载/热重载）'],
  17: ['config-driven-loading', 'D', '配置驱动插件加载（mini 版）'],
  18: ['monorepo-refactor', 'E', '垂直切片拆成 pnpm workspace'],
  19: ['core-services', 'E', '核心服务接口定义'],
  20: ['system-prompt-assembly', 'E', '系统提示词：插件注册 section'],
  21: ['event-domain-split', 'E', 'durable session/event 与 live agent/* 划分'],
  22: ['step-lifecycle', 'F', 'Step：一次模型请求 + 其工具执行'],
  23: ['turn-lifecycle', 'F', 'Turn：开启、多 step、关闭'],
  24: ['inbox-and-steering', 'F', '收件箱：queued / steering / injected'],
  25: ['pre-step-waterfall', 'F', 'pre-step 瀑布与请求拦截'],
  26: ['tool-definition', 'G', 'ToolDefinition 与 JSON schema'],
  27: ['execution-pipeline', 'G', 'pre/guards/execute/post/result'],
  28: ['concurrency-scheduler', 'G', 'barrier 与 rolling pool 并行调度'],
  29: ['timeout-retry-metrics', 'G', '超时、重试、指标统计'],
  30: ['approval-and-permission', 'G', '审批与权限（工具级放行）'],
  31: ['llm-adapter-seam', 'H', 'LLM 适配器接缝：消息/流词汇表'],
  32: ['deepseek-real-adapter', 'H', 'DeepSeek 真实接入（v4-flash/pro、thinking）'],
  33: ['error-classification', 'H', '错误分类与重试策略'],
  34: ['capability-seam-3layers', 'H', '三层能力缝：Definition/Provider/Consumer'],
  35: ['fs-subprocess-swap', 'H', 'fs/subprocess 本地与远程后端切换'],
  36: ['cordis-yml-loader', 'I', 'cordis.yml 与插件树加载'],
  37: ['profiles-bundles-patches', 'I', 'profile/bundle/patch 分层覆盖'],
  38: ['credentials-and-env', 'I', '凭据管理与环境变量'],
  39: ['presets-products', 'I', 'presets：一套代码多种产品形态'],
  40: ['entrypoints', 'I', 'headless CLI → Web UI → JSON-RPC/ACP'],
  41: ['workspace-guard', 'J', '工作区边界与文件守卫'],
  42: ['cancellation', 'J', '取消与进程树清理'],
  43: ['context-compaction', 'J', '上下文压缩：压力检测/裁剪/摘要'],
  44: ['steering-receipts', 'J', 'steering 语义与消息确认（receipt）'],
  45: ['telemetry-cost', 'J', '遥测与 token 统计'],
  46: ['subagent-provider', 'K', '子代理 provider（in-process/远程）'],
  47: ['multi-agent-workflow', 'K', '多 Agent 编排与 workflow'],
  48: ['publish-plugin', 'K', '写并发布一个插件'],
  49: ['capstone', 'K', '结业项目（三选一）'],
  50: ['benchmark-and-review', 'K', '与官方 dsh 对比评测与复盘'],
};

function pad(n) {
  return String(n).padStart(2, '0');
}

function template({ num, slug, stage, title }) {
  const nn = pad(num);
  return {
    'README.md': `# ${nn}-${slug}

阶段 ${stage} · 第 ${num} 课

## 本课主题

${title}

## 目录导览

- [lecture.md](lecture.md) — 讲义
- [homework.md](homework.md) — 作业验收
- [code/](code/) — 本课代码（可运行 + 测试）
`,
    'lecture.md': `# ${nn}-${slug} 讲义

> TODO：填写概念讲解、示例与小结。

## 目标

- 

## 讲解

## 小结
`,
    'homework.md': `# ${nn}-${slug} 作业

> TODO：填写作业要求与验收标准。

## 作业

## 验收标准

\`\`\`bash
node tools/verify-lesson.mjs lessons/${nn}-${slug}
\`\`\`
`,
  };
}

async function gen(ids) {
  for (const id of ids) {
    const entry = LESSONS[id];
    if (!entry) {
      console.error(`未知课号: ${id}`);
      process.exitCode = 1;
      continue;
    }
    const [slug, stage, title] = entry;
    const dir = join(root, 'lessons', `${pad(id)}-${slug}`);
    const files = {
      ...template({ num: id, slug, stage, title }),
      'code/.gitkeep': '',
    };
    for (const [rel, content] of Object.entries(files)) {
      const file = join(dir, rel);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, content);
    }
    console.log(`✔ lessons/${pad(id)}-${slug}`);
  }
}

const args = process.argv.slice(2);
const ids = args.length ? args.map(Number) : Object.keys(LESSONS).map(Number);
await gen(ids);
console.log(`完成，共处理 ${ids.length} 课。`);
