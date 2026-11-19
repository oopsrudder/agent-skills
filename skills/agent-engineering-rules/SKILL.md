---
name: agent-engineering-rules
display_name: "多 Agent 工程规则"
display_name_en: "Agent Engineering Rules"
version: 1.0.0
description: 一套可直接落地的工程规范（先根因后修复、限制定时器、最小化 useEffect、精简注释、审查导入、按功能分目录、不擅自建 Markdown，附交付自检清单），并提供脚本把规范一键注入本机各 AI 编码 agent 的全局规则文件（WorkBuddy、Claude Code、Codex CLI、Gemini CLI、opencode、Qoder）。当用户要求「把这份规范设置成 agent 规则」「给 Claude Code / Codex / Gemini / opencode / Qoder 配置全局规则」「统一多套 AI 工具的开发规范」「同步 / 更新工程规则」时使用。
description_zh: "把一套可判定的工程规范一键写进本机所有 AI 编程工具的全局规则文件，覆盖 6 个有文件通道的 agent，其余给出设置面板位置。"
description_en: "Ship one set of enforceable engineering rules into every AI coding agent's global rules file with a single command."
agent_created: true
---

# Agent 工程规则

## 用途

把一份经过约束的工程规范分发到本机所有 AI 编码 agent 的全局规则文件，让不同工具（WorkBuddy、Claude Code、Codex CLI、Gemini CLI、opencode、Qoder）按同一套标准改代码。规范正文在 `assets/engineering-rules.md`，注入逻辑在 `scripts/install.mjs`。

## 工作流

### 1. 探测目标

```bash
node scripts/install.mjs --list
```

输出每个 agent 的全局规则路径、是否已检测到（依据其配置目录是否存在），以及哪些只能应用内设置。先看结果再动手，不要给用户装不存在的工具创建目录。

### 2. 预演

```bash
node scripts/install.mjs --dry-run
```

只报告将新增 / 更新 / 追加哪些文件，不落盘。用户对环境有顾虑、或需要确认改动范围时先跑这一步。

### 3. 写入

```bash
node scripts/install.mjs                 # 只写已检测到的 agent
node scripts/install.mjs --all           # 目标不存在也创建
node scripts/install.mjs --only claude,qoder
```

行为约定：

- 已有规则文件 → 在末尾追加标记块，原有内容一字不动；已有同名标记块 → 原地替换，因此可反复执行。
- WorkBuddy → 除 `~/.workbuddy/SOUL.md` 外，自动扫描 `~/.workbuddy/user-*/SOUL.md`（个人档案副本，实际注入会话的那份）一并写入。
- Qoder → 写入 `~/.qoder/memory/engineering-rules.md`（自动补 frontmatter），并在 `~/.qoder/memory/MEMORY.md` 登记索引，索引已存在时不重复。
- Cursor / Trae / Windsurf → 脚本不写文件，只提示面板位置。

### 4. 手动收尾

对无文件通道的 agent，执行 `node scripts/install.mjs --print` 输出规则正文，交给用户粘贴到对应设置页。汇报时明确区分「已自动写入」和「需手动粘贴」两类。

### 5. 让各 agent 都能调用本 skill

```bash
node scripts/install.mjs --link-skill            # 软链到各 agent 的 skills 目录
node scripts/install.mjs --link-skill --copy     # 改用复制（跨盘 / 无软链权限时）
node scripts/install.mjs --link-skill --force    # 覆盖同名目录
```

逐个检查 `~/.workbuddy`、`~/.claude`、`~/.codex`、`~/.gemini`、`~/.cursor`、`~/.trae`、`~/.qoder`、`~/.config/opencode` 下的 `skills/` 并链接当前 skill 本体。已存在同名目录时默认跳过，避免覆盖别人装的同名技能；软链失败（如 Windows 无权限）自动退回复制。

## 定制规范

改 `assets/engineering-rules.md` 即改所有目标的内容，重跑安装命令完成同步。规范本身按七条硬约束组织，每条都要能被判定是否遵守：

| 章节 | 约束要点 |
|---|---|
| 先根因后修复 | 禁止吞异常、堆判空、复制逻辑绕缺陷、调大超时掩盖失败；定位不到根因必须声明「只是缓解」 |
| 定时器 | 默认禁用；可用时须同时给出原因注释、清理逻辑、不复发保证 |
| React 副作用 | 列出 useEffect 允许的四类场景与禁止的四类用法 |
| 注释 | who/why/what 具体化为必写项与禁写项 |
| 导入与依赖 | 逐条审查清单 + 主线程与 Worker 边界 + 新依赖举证 |
| 目录与整洁 | 按功能分夹、单向分层、收尾清理 |
| 文档 | 不擅自新建 Markdown |

新增条款时保持同一句式：一句可判定的约束 + 反例枚举，避免写成口号。

## 资源

- `assets/engineering-rules.md` — 规范正文，注入内容的唯一来源，不要在其他文件里复制它。
- `scripts/install.mjs` — 跨平台安装器（Node 18+，零依赖），支持 `--list` / `--dry-run` / `--only` / `--all` / `--print` / `--link-skill`。
- `references/agent-targets.md` — 每个 agent 的规则落点、实测结论与踩坑记录（Qoder 记忆开关、opencode 层级继承、Cursor 无文件通道等）。修改注入路径前先读它。

## 注意

- 不要用 `~/AGENTS.md` 充当全局规则，它只对按目录向上查找的工具生效。
- 不要直接改注入后的文件来「微调」，下次同步会被覆盖；改 `assets/` 里的正文。
- Windows 用 `%USERPROFILE%` 作为 HOME，脚本已兼容；路径含空格无需额外处理。
