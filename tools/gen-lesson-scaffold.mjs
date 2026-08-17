#!/usr/bin/env node
/**
 * 一键生成/重建课程骨架。
 * 用法：
 *   node tools/gen-lesson-scaffold.mjs            # 生成全部 53 课
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
  11: ['event-vocabulary', 'C', '事件词汇表：类型化 SessionEventMap 与声明合并'],
  12: ['replay-and-snapshots', 'C', '重放与 golden transcript 测试'],
  13: ['context-and-plugin', 'D', 'Context 与插件模型：一切皆插件原则与插件边界'],
  14: ['services-and-inject', 'D', '服务注册 ctx.xxx 与 inject 依赖'],
  15: ['event-dispatch-modes', 'D', '事件四模式：emit/waterfall/parallel/serial'],
  16: ['effects-and-teardown', 'D', 'effect 与可逆注册：卸载 / 热重载 / 状态保留'],
  17: ['config-driven-loading', 'D', '配置驱动插件加载与热重载（include/loader）'],
  18: ['monorepo-refactor', 'E', '垂直切片拆成 pnpm workspace，换装真实 cordis 内核'],
  19: ['core-services', 'E', '核心服务接口定义（session/tools/llm/agent/agent-loop）'],
  20: ['system-prompt-assembly', 'E', '系统提示词：PromptSection 顺序约定 + 动态 PromptContext'],
  21: ['event-domain-split', 'E', 'durable session/event 与 live agent/* 划分'],
  22: ['step-lifecycle', 'F', 'Step：一次模型请求 + 其工具执行'],
  23: ['turn-lifecycle', 'F', 'Turn：开启、多 step、关闭'],
  24: ['inbox-and-steering', 'F', '收件箱：next-turn / next-step + steer / inject'],
  25: ['pre-step-waterfall', 'F', 'agent/pre-step 瀑布：改写与拒绝'],
  26: ['tool-definition', 'G', 'defineTool：schema / output / render / 卡片'],
  27: ['execution-pipeline', 'G', 'pre/guards/approval/execute/post/finalize/result'],
  28: ['concurrency-scheduler', 'G', '并行调度与 Code Mode run_code'],
  29: ['timeout-retry-metrics', 'G', '超时、重试、指标统计'],
  30: ['approval-and-permission', 'G', '审批（ctx.approval）与权限预设'],
  31: ['llm-adapter-seam', 'H', 'LLM 适配器接缝：Message/ContentBlock/StreamChunk'],
  32: ['deepseek-real-adapter', 'H', 'DeepSeek 真实接入（v4、thinking/reasoning block）'],
  33: ['error-classification', 'H', '错误分类与重试策略'],
  34: ['capability-seam-3layers', 'H', '能力缝三角色：Definition/Provider/Consumer'],
  35: ['fs-subprocess-swap', 'H', 'fs/subprocess/shell/terminals 后端切换'],
  36: ['cordis-yml-loader', 'I', 'cordis.yml 与插件树加载（include/group、!!js 表达式）'],
  37: ['profiles-bundles-patches', 'I', 'profile/bundle/patch 分层（dsh.profile / dsh.bundle / --patch）'],
  38: ['credentials-and-env', 'I', '凭据管理与环境变量分层'],
  39: ['presets-products', 'I', 'agent presets：按会话组装能力集 + isolate 隔离域'],
  40: ['entrypoints', 'I', 'headless CLI → Web UI → JSON-RPC/ACP（+ Python SDK）'],
  41: ['skills-and-tools', 'J', 'Skills 子系统：skill 注册表、文件系统 provider 与 skill 工具'],
  42: ['ui-as-plugin', 'J', 'UI 组件即插件：ConversationNode + keyed renderer + ui-slots + 客户端 HMR'],
  43: ['dynamic-self-modification', 'J', '动态插件：agent 写双半插件并热重载到前端（cordis_* 工具集）'],
  44: ['workspace-guard', 'K', '工作区边界与文件守卫'],
  45: ['cancellation', 'K', '取消与进程树清理'],
  46: ['context-compaction', 'K', '上下文压缩：压力检测/裁剪/摘要'],
  47: ['steering-receipts', 'K', 'steering 语义与消息确认（receipt）'],
  48: ['telemetry-cost', 'K', '遥测与 token 统计'],
  49: ['subagent-provider', 'L', '子代理 provider（in-process / ACP / 远程）'],
  50: ['multi-agent-workflow', 'L', '多 Agent 编排与 workflow'],
  51: ['publish-plugin', 'L', '写并发布一个插件（bundle/profile、dsh plugin add）'],
  52: ['capstone', 'L', '结业项目（三选一）'],
  53: ['benchmark-and-review', 'L', '与官方 dsh 对比评测与复盘'],
};

// 各课“本课涵盖”要点；未列出的课默认只展示主题。
const TOPICS = {
  13: [
    'Context 与插件模型',
    '一切皆插件：原则与边界',
    '服务注入 ctx.xxx',
    '与真实 cordis 的 API 对齐',
  ],
  16: [
    'effect：可逆注册',
    '卸载与清理（teardown）',
    '热重载：替换插件树不重启',
    '状态保留与回滚',
  ],
  17: [
    'include / group 与 !!js 表达式',
    '监听配置变更（watchUserPatches）',
    '配置热重载与插件树重建',
    '失败回滚到稳定快照',
  ],
  40: [
    'dsh CLI：--profile web / headless / plugin',
    'Web 应用与前端静态托管',
    'JSON-RPC / ACP 入口 + Python SDK',
    '配置转储（--dump-config）',
  ],
  41: [
    'ctx.skills：skill provider 注册表',
    'skill-filesystem：本地 skill 目录 provider',
    'tool-skill：会话前缀 skill 目录 + 加载器 schema',
    'skill 工具与目录即插即用',
  ],
  42: [
    'ConversationNodeDefinition + keyed renderer',
    'ChatNodeDataMap / ConversationStepDataMap 声明合并',
    'ui-slots 组件席位（SlotMap）',
    '客户端 HMR：插件重建 → 浏览器热替换',
  ],
  43: [
    'cordis_inspect / define / run / stop / undefine',
    'host 半（vm 沙箱）+ browser 半（React 闭包）',
    'cordis/request-run 审批往返',
    '渲染错误隔离与回滚、内存态生命周期',
  ],
};

// 各课“扩展课时/作业（可选）”，对应生产级补强；未列出的课没有扩展项。
const EXTENSIONS = {
  3: [
    '任务：为会话日志引入 trace_id / correlation id，跨组件事件可串联。验收：两个组件日志用同一 trace_id 关联，写出串联 demo。',
    '任务：把轨迹转成结构化 JSON 行，可用 grep/jq 分析。验收：sample-session.jsonl 用 jq 能过滤出全部 tool_call 事件。',
  ],
  7: [
    '任务：用 AbortController 实现 SSE 中途取消，取消后断开连接并释放资源。验收：取消后服务端收到中断，无悬挂连接。',
    '任务：处理流式 tool_call 参数分片（增量 JSON 拼接）。验收：分片任意顺序到达都能拼出完整参数并执行。',
    '任务：流式消费加 backpressure，慢消费者不丢事件。验收：消费者暂停时事件积压不溢出，恢复后继续。',
  ],
  8: [
    '任务：mock LLM 支持故障注入：429、超时、畸形 JSON、流中断。验收：同一请求可在正常/故障 fixture 间切换回放。',
    '任务：用故障注入验证重试与错误路径。验收：重试逻辑测试覆盖 429 与超时两条路径。',
  ],
  12: [
    '任务：session 落盘抽象（JSONL/SQLite，对应 ctx.sessionPersistence seam）。验收：kill -9 后重启进程能从日志恢复 session 继续。',
    '任务：checkpoint/resume：从日志重建上下文并继续新 step。验收：恢复后的 derive-messages 与崩溃前一致。',
    '任务：golden 更新流程：变更需显式命令更新并留 diff。验收：提供 update-golden 命令并纳入 CI。',
  ],
  29: [
    '任务：实现令牌桶限流与 429/配额处理、指数退避。验收：配额耗尽时请求被平滑限流而非立即失败。',
    '任务：超时/重试策略按错误类型分级（可重试/不可重试）。验收：不可重试错误不进入退避循环。',
  ],
  32: [
    '任务：模型路由：便宜模型做初判/路由，贵模型做终答。验收：同一任务可配置路由策略并观察 token 成本差异。',
    '任务：供应商故障切换：主模型 5xx 时自动降级备用模型并记录遥测。验收：故障注入下请求成功且遥测含 fallback 标记。',
    '任务：thinking 模式：reasoning block 单独计数与展示。验收：轨迹中 reasoning 与回答 token 分开统计。',
  ],
  40: [
    '任务：CLI 打包为可安装二进制（esbuild/bun build）并 npm 发布。验收：npm i -g 后可直接运行 dsh 命令。',
    '任务：Docker 镜像 + daemon 化运行。验收：docker run 启动服务，配置与日志走挂载卷。',
    '任务：配置发现三级：全局/用户/项目，优先级明确。验收：三处配置合并结果符合优先级约定。',
  ],
  44: [
    '任务：prompt injection 缓解：工具结果标记为不可信内容并隔离。验收：注入测试不改变系统指令、不泄露凭据。',
    '任务：日志/轨迹脱敏：API key、文件内容等敏感字段打码。验收：轨迹与日志中无明文密钥。',
    '任务：沙箱执行后端（容器）与网络出口控制、操作审计。验收：沙箱内命令无法访问工作区外路径并留审计记录。',
  ],
  46: [
    '任务：token 记账（ctx.tokenMeter）与工具结果裁剪（tool-result-pruner）、消息预算分配。验收：长会话按预算裁剪后仍能完成任务。',
    '任务：摘要质量评估：压缩后重放，任务完成率不下降。验收：同一任务压缩前后完成率对比数据。',
  ],
  48: [
    '任务：每会话/每日成本上限与超预算熔断。验收：预算耗尽时 agent 停止并返回原因。',
    '任务：指标导出（OpenTelemetry / Prometheus）与结构化日志。验收：外部可抓取 token/耗时/成本指标。',
  ],
  50: [
    '任务：跨 agent 消息协议与共享上下文/工作区锁。验收：多 agent 并发写同一文件时无冲突。',
    '任务：任务分解与依赖编排、并行结果合并。验收：3 个子代理并行任务按依赖顺序执行并合并结果。',
  ],
  51: [
    '任务：插件版本解析（semver）、依赖锁定、加载冲突检测。验收：同一插件两个版本可共存或可回滚。',
    '任务：发布前自动验证：验收脚本接入发布流程。验收：CI 在发布前跑插件测试与验收脚本。',
  ],
  53: [
    '任务：稳定性压测：同任务跑 100 次，统计成功率/超时率/成本中位数。验收：产出稳定性报告。',
    '任务：用 mini-dsh 完成 2-3 个真实任务（编码/自动化）。验收：真实任务结果与官方 dsh 对照表。',
  ],
};

function pad(n) {
  return String(n).padStart(2, '0');
}

function template({ num, slug, stage, title, topics, extensions }) {
  const nn = pad(num);
  const topicsBlock = topics.length
    ? `\n## 本课涵盖\n\n${topics.map((t) => `- ${t}`).join('\n')}\n`
    : '';
  const extensionsBlock = extensions.length
    ? `\n## 扩展课时/作业（可选）\n\n> 生产级补强，不影响主课验收。\n\n${extensions.map((e) => `- ${e}`).join('\n')}\n`
    : '';
  return {
    'README.md': `# ${nn}-${slug}

阶段 ${stage} · 第 ${num} 课

## 本课主题

${title}
${topicsBlock}

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
${extensionsBlock}
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
      ...template({
        num: id,
        slug,
        stage,
        title,
        topics: TOPICS[id] ?? [],
        extensions: EXTENSIONS[id] ?? [],
      }),
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
