export const name = 'page-algorithm'
export const inject = ['pageEditor']

const DEFAULTS = {
  title: '1. Two Sum',
  difficulty: 'Easy',
  prompt:
    '给定一个整数数组 nums 和一个整数目标值 target，请你在该数组中找出和为目标值的那两个整数，并返回它们的数组下标。\n\n你可以假设每种输入只会对应一个答案。数组中同一个元素在答案里不能重复出现。',
  lang: 'python',
  code: `class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        seen = {}
        for i, n in enumerate(nums):
            if target - n in seen:
                return [seen[target - n], i]
            seen[n] = i
        return []`,
}

const DIFF_COLOR: Record<string, string> = {
  Easy: '#00b8a3',
  Medium: '#ffc01e',
  Hard: '#ff375f',
}

function AlgorithmCard({
  data,
  update,
  writable,
}: {
  data: Record<string, unknown>
  update: (patch: Record<string, unknown>) => void
  writable: boolean
}) {
  const title = String(data.title ?? '')
  const difficulty = String(data.difficulty ?? 'Easy')
  const prompt = String(data.prompt ?? '')
  const lang = String(data.lang ?? 'python')
  const code = String(data.code ?? '')
  const accent = DIFF_COLOR[difficulty] ?? '#00b8a3'
  const ro = !writable

  const field = {
    width: '100%',
    boxSizing: 'border-box' as const,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: 'inherit',
    font: 'inherit',
    resize: 'vertical' as const,
  }

  return (
    <div
      data-testid="page-algorithm-card"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        minHeight: 280,
        borderRadius: 10,
        overflow: 'hidden',
        border: '1px solid #30363d',
        background: '#1e1e1e',
        color: '#e6edf3',
        font: '13px/1.5 ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <section
        style={{
          flex: '1 1 240px',
          minWidth: 220,
          maxWidth: '50%',
          padding: '14px 16px 16px',
          background: '#262626',
          borderRight: '1px solid #30363d',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', opacity: 0.55 }}>DESCRIPTION</span>
          <select
            data-testid="page-algorithm-diff"
            disabled={ro}
            value={difficulty}
            onChange={(event) => update({ difficulty: event.target.value })}
            style={{
              marginLeft: 'auto',
              border: 'none',
              borderRadius: 999,
              padding: '2px 8px',
              background: 'transparent',
              color: accent,
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            <option>Easy</option>
            <option>Medium</option>
            <option>Hard</option>
          </select>
        </div>
        <input
          data-testid="page-algorithm-title"
          readOnly={ro}
          value={title}
          onChange={(event) => update({ title: event.target.value })}
          style={{ ...field, fontSize: 18, fontWeight: 700, marginBottom: 10 }}
        />
        <textarea
          data-testid="page-algorithm-prompt"
          readOnly={ro}
          value={prompt}
          onChange={(event) => update({ prompt: event.target.value })}
          style={{ ...field, minHeight: 160 }}
        />
      </section>
      <section style={{ flex: '1 1 260px', minWidth: 240, display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderBottom: '1px solid #30363d',
            fontSize: 12,
          }}
        >
          <span style={{ opacity: 0.55, fontWeight: 700 }}>Code</span>
          <select
            data-testid="page-algorithm-lang"
            disabled={ro}
            value={lang}
            onChange={(event) => update({ lang: event.target.value })}
            style={{ marginLeft: 'auto', background: '#262626', color: 'inherit', border: '1px solid #30363d', borderRadius: 6, padding: '2px 8px' }}
          >
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="java">Java</option>
            <option value="cpp">C++</option>
          </select>
        </div>
        <textarea
          data-testid="page-algorithm-code"
          readOnly={ro}
          spellCheck={false}
          value={code}
          onChange={(event) => update({ code: event.target.value })}
          style={{
            ...field,
            flex: 1,
            minHeight: 200,
            padding: 12,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fontSize: 12,
            lineHeight: 1.55,
            color: '#d4d4d4',
          }}
        />
      </section>
    </div>
  )
}

export function apply(ctx: {
  pageEditor: {
    registerBlock: (spec: {
      kind: string
      label: string
      hint?: string
      aliases?: string[]
      defaults?: Record<string, unknown>
      View: (props: { data: Record<string, unknown>; update: (patch: Record<string, unknown>) => void; writable: boolean }) => unknown
    }) => void
  }
}) {
  ctx.pageEditor.registerBlock({
    kind: 'algorithm',
    label: '算法题',
    hint: 'LeetCode 风：左题目右代码',
    aliases: ['leetcode', 'algo', '算法', 'lc'],
    defaults: DEFAULTS,
    View: AlgorithmCard,
  })
}
