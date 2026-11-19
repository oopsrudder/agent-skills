# 各 agent 的全局规则落点

本文件记录每个 agent 实际读取的全局规则文件，以及写入时的注意事项。判定依据是各客户端的官方行为与本机安装包的实测结果。

## 有文件通道（脚本可直接写）

| id | Agent | 全局规则文件 | 说明 |
|---|---|---|---|
| `workbuddy` | WorkBuddy | `~/.workbuddy/SOUL.md` | 每次会话注入；除规则外还承担人格设定，追加写入，不动原有段落 |
| `claude` | Claude Code | `~/.claude/CLAUDE.md` | 用户级记忆，下次启动生效 |
| `codex` | Codex CLI | `~/.codex/AGENTS.md` | 全局 AGENTS.md；项目根的同名文件优先级更高 |
| `gemini` | Gemini CLI | `~/.gemini/GEMINI.md` | 串行注入到系统提示，追加在原有理念之后 |
| `opencode` | opencode | `~/.config/opencode/AGENTS.md` | 启动时会 watcher 订阅该路径；此外逐层向上读取 `~/AGENTS.md` 与项目根 `AGENTS.md` |
| `qoder` | Qoder | `~/.qoder/memory/engineering-rules.md` | 走「记忆」体系，需 frontmatter + `MEMORY.md` 索引 |

## 只有应用内设置（脚本无法写入）

| Agent | 位置 |
|---|---|
| Cursor | `Settings → Rules → User Rules` |
| Trae | `设置 → 规则 / Rules → 用户规则` |
| Windsurf | `Settings → Cascade → Rules` |

用 `node scripts/install.mjs --print` 输出规则正文，粘贴到上述面板即可。

## 容易踩的坑

- **Qoder 不是 rules 目录制**。安装包里检索不到 `AGENTS.md`、`.qoder/rules` 等路径；规则统一归到「记忆」，入口是 `设置 → 记忆 → 全局记忆`。该开关关闭时，写进去的文件不会被读取。
- **Qoder 的记忆会被它自己改写**。所以规则正文以 skill 的 `assets/engineering-rules.md` 为准，出现偏差时重跑脚本覆盖回来。
- **opencode 是层级继承**，不是单一文件。写在 `~/.config/opencode/AGENTS.md` 的是最底层的全局兜底，项目根的 `AGENTS.md` 会叠加在它之上。
- **Cursor 的 User Rules 存在应用数据库里**，没有可写的 Markdown 文件，不要试图在 `~/.cursor/` 下造文件。
- **不要写 `~/AGENTS.md` 当全局规则**。它只对 opencode 这类按目录向上查找的工具有效，对其他 agent 无效，还会误伤在 home 目录下运行的项目。
- **标记块冲突**。所有写入都包在 `<!-- workbuddy:engineering-rules BEGIN/END -->` 里，重复执行是替换而非追加；手工改动请保持在块内，否则下次同步会被覆盖。
