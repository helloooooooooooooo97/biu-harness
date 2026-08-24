#!/usr/bin/env node
/**
 * 无云API 的流式对话模拟器
 * 演示目标：
 *   1. 一个流里同时承载 thinking（思考）和 text（要说的）
 *   2. 两个独立消费者分流：thinking -> 存脑内日志；text -> 走"嘴"（语音）
 *   3. 边想边说：thinking 和 text 错位并行
 *   4. 打断只掐嘴、不断脑：interrupt 时 text 端停，thinking 端继续跑
 */
const chars = {
  '\x1b[90m': '', '\x1b[0m': '', '\x1b[36m': '', '\x1b[33m': '',
  '\x1b[90m▪': '▪', 
};
function dim(s){ return `\x1b[90m${s}\x1b[0m`; }
function cyan(s){ return `\x1b[36m${s}\x1b[0m`; }
function yellow(s){ return `\x1b[33m${s}\x1b[0m`; }
function green(s){ return `\x1b[32m${s}\x1b[0m`; }
function red(s){ return `\x1b[31m${s}\x1b[0m`; }

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * 模拟"流式模型"：单条流里塞带 type 标签的块。
 * 假装它边想边说：thinking 先来，text 稍后，交替涌现。
 */
function* mockModelStream(text) {
  // 脑内思考草稿
  const thoughts = [
    "用户问怎么做到「想很多说得少」",
    "核心：把完整结论先想出来，再单独做话术摘取",
    "需要拆 thinking 流和 text 流，用 type 标签区分",
    "打断时只丢 text，thinking 照跑 => 关键点",
  ];
  // 真正要说的口语 (精简)
  const spoken = [
    "把它分成两步，",
    "先想透，",
    "再说人话。",
    "断嘴不断脑。",
  ];
  for (let i = 0; i < thoughts.length; i++) {
    yield { type: 'thinking', content: thoughts[i] }; // 脑在前面动
    yield { type: 'text',     content: spoken[i] };   // 嘴在后面说
  }
}

// ---- 分流器：同一 generator，两个消费者各取所需 ----
async function runOnce({ allowInterrupt = true, interruptAt = 250 } = {}) {
  console.log('\n'+('='.repeat(66)).replace(/./g,'='));
  console.log(cyan('  单条流模拟：thinking(脑) 与 text(嘴) 由 type 标签分流'));
  console.log(('='.repeat(66)).replace(/./g,'='));

  const brain = [];          // 思考流消费者（脑内日志，不外放）
  let speakBuf = '';         // 回复流消费者（嘴）
  let interrupted = false;

  const gen = mockModelStream();
  let t = 0;
  for (const block of gen) {
    t += 90; // 每块间隔
    if (block.type === 'thinking') {
      brain.push(block.content); // 脑，永远收
      console.log(`${dim('  ·脑·')} ${dim(block.content)}`);
    } else {
      // 嘴，可能被掐
      if (interrupted) {
        console.log(`${red('  ✕嘴(被打断，丢弃)')}`);
        continue;
      }
      speakBuf += block.content;
      console.log(`${green('  ▶嘴(')}${speakBuf}${green(')')}`);
    }

    // 模拟用户随时插话 => 打断
    if (allowInterrupt && !interrupted && t >= interruptAt) {
      interrupted = true;
      console.log(`\n  ${yellow('…用户插话「打断！」…')}`);
      console.log(`${yellow('  → 掐嘴：TTS 立即静音（text 不再外放）')}`);
      console.log(`${yellow('  → 不断脑：thinking 流继续收')}\n`);
    }
    await sleep(50);
  }

  console.log('\n'+('-'.repeat(66)).replace(/./g,'-'));
  console.log(dim('  [脑内完整思考] ') + JSON.stringify(brain));
  console.log(green('  [说到一半的话] ') + JSON.stringify(speakBuf));
  console.log(cyan('  ✔ 结论：thinking 全程收满，text(嘴) 被掐断口。断嘴≠断脑。'));
  console.log('-'.repeat(66));
}

// ---- 案例 A：不打断，看看「边想边说」能说到多少 ----
(async () => {
  console.log(dim('\n【案例 A】不打断 —— 演示"边想边说"：嘴随脑顺序吐完'));
  await runOnce({ allowInterrupt: false });

  console.log(dim('\n【案例 B】中途打断 —— 演示"断嘴不断脑"：脑收满，嘴被掐'));
  await runOnce({ allowInterrupt: true, interruptAt: 240 });

  console.log('\n');
})();
