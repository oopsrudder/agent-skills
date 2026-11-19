# Agent Engineering Rules

One set of enforceable engineering rules, shipped into every AI coding agent's global rules file with a single command.

Different agents, same standards: root-cause-first fixes, no timer hacks, minimal `useEffect`, terse comments, audited imports, feature-first directory layout, no unsolicited Markdown.

## Install

```bash
npx skills add oopsrudder/agent-skills --skill agent-engineering-rules
```

Or copy the folder into your agent's skills directory.

## Use

Ask your agent to "set up the engineering rules" / 「把工程规则配置到我机器上的 AI 工具」, or run the installer directly:

```bash
node scripts/install.mjs --list      # what is installed, and where each rule file lives
node scripts/install.mjs --dry-run   # preview, writes nothing
node scripts/install.mjs             # write to detected agents only
node scripts/install.mjs --print     # print the rules, for pasting into Cursor / Trae / Windsurf
node scripts/install.mjs --link-skill  # expose this skill to every agent's skills/ directory
```

## What it writes

| Agent | File |
|---|---|
| WorkBuddy | `~/.workbuddy/SOUL.md` + `~/.workbuddy/user-*/SOUL.md` |
| Claude Code | `~/.claude/CLAUDE.md` |
| Codex CLI | `~/.codex/AGENTS.md` |
| Gemini CLI | `~/.gemini/GEMINI.md` |
| opencode | `~/.config/opencode/AGENTS.md` |
| Qoder | `~/.qoder/memory/engineering-rules.md` (+ index entry in `MEMORY.md`) |
| Cursor / Trae / Windsurf | no file channel — the script prints the panel location instead |

**This skill modifies global config files of the agents you already have installed.** Read `scripts/install.mjs` before running it if that matters to you. Every write is wrapped in `<!-- workbuddy:engineering-rules BEGIN/END -->`, so:

- existing content is appended to, never replaced;
- re-running is idempotent — the block is replaced in place;
- uninstall = delete that block from each file (or run with `--dry-run` first to see the list).

It never creates directories for agents that are not installed.

## The rules

`assets/engineering-rules.md` is the single source of truth. Seven sections, each written as a checkable constraint plus counter-examples:

1. Root cause before fix — no swallowed exceptions, no defensive null checks papering over a bug, no widened timeouts to hide a failure.
2. Timers — off by default; allowed only with a stated reason, a cleanup path, and a reason it will not recur.
3. React effects — four allowed uses, four forbidden ones.
4. Comments — who/why/what made concrete; naming beats commenting.
5. Imports — per-import audit, main-thread/worker boundary, new dependencies must be justified.
6. Structure — feature folders, one-way layering, cleanup before you call it done.
7. Docs — no Markdown files unless asked.

Edit that file, re-run the installer, and every agent is updated at once.

## 中文说明

把一套可判定的工程规范一键写进本机所有 AI 编程工具的全局规则文件。覆盖 WorkBuddy、Claude Code、Codex CLI、Gemini CLI、opencode、Qoder 六个有文件通道的工具，Cursor、Trae、Windsurf 给出设置面板位置。

安装器只写已装工具、追加而非覆盖、可反复执行；规范正文集中在 `assets/engineering-rules.md`，改一处即可全量同步。

注意：它会修改你已安装 agent 的全局配置文件，运行前可先 `node scripts/install.mjs --dry-run` 确认改动范围。

## Layout

```
skills/agent-engineering-rules/
├── SKILL.md                       # triggers + workflow
├── assets/engineering-rules.md    # the rules themselves
├── scripts/install.mjs            # cross-platform installer, zero deps
└── references/agent-targets.md    # per-agent paths and gotchas
```
