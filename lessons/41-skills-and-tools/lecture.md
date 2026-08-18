# 41-skills-and-tools 讲义

## 目标

- 实现 **Skills 子系统**：`Skill`（名字/描述/内容）、`SkillProvider`（列表/加载）、`SkillRegistry`（多 provider 聚合）。
- 实现文件系统 provider：技能 = 目录里的 markdown，即插即用。
- 实现模型面 `skill` 工具：agent 可以列出/加载技能。

## 1. Skill 是什么

```ts
interface Skill {
  name: string
  description: string
  content?: string
}
```

技能 = "agent 按需加载的指令/知识包"（写代码的规范、调试流程、团队约定……）。它和工具的区别：工具是**动作**，技能是**知识**。

## 2. Provider 与注册表

```ts
registry.register(new FilesystemSkillProvider(skillsDir))   // 本地目录
registry.list()   // 所有 provider 的技能并集
registry.load('code-style')   // 加载内容
```

skill 是能力缝（第 34 课）：定义（接口）+ Provider（文件系统/远程）+ Consumer（skill 工具）。

## 3. 模型面 skill 工具

```ts
skill.list → 可用技能目录
skill.load(name) → 技能内容（注入上下文）
```

agent 在干活前查技能目录、按需加载——技能让"团队约定"成为模型可见的知识。

## 4. 与 dsh 的对照

dsh 的 `ctx.skills` + `skill-filesystem` + `tool-skill` 就是这三件：技能目录进会话前缀（skill catalog），`skill` 工具负责加载。

## 小结

- Skill = 知识包；Provider = 来源；Registry = 聚合；tool = 模型入口。
- 技能即插即用：往目录放一个 md 就是新技能。

## 预习

- 技能内容怎么进模型？（第 42 课：UI 组件即插件，或回看第 20 课 prompt 组装。）
