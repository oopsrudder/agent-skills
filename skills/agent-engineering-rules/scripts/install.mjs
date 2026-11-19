#!/usr/bin/env node
/**
 * 把 assets/engineering-rules.md 注入本机各 AI 编码 agent 的全局规则文件。
 * 幂等：重复执行只替换标记块，文件其余内容原样保留。
 *
 * 用法：
 *   node install.mjs                 自动检测已安装的 agent 并写入
 *   node install.mjs --dry-run       只报告将改动的文件，不落盘
 *   node install.mjs --list          列出支持的所有 agent 及路径
 *   node install.mjs --only claude,qoder
 *   node install.mjs --all           目标文件不存在也创建
 *   node install.mjs --print         输出规则正文（供手动粘贴到 Cursor 等）
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, lstatSync, symlinkSync, readlinkSync, cpSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = resolve(HERE, '..', 'assets', 'engineering-rules.md');
const BEGIN = '<!-- workbuddy:engineering-rules BEGIN -->';
const END = '<!-- workbuddy:engineering-rules END -->';
const HOME = process.env.HOME || process.env.USERPROFILE || homedir();

const QODER_FRONTMATTER = `---
name: engineering-rules
description: 代码实现/修改/重构必须遵守的工程规则：先根因后修复、限制定时器、最小化 useEffect、精简注释、审查导入、按功能组织目录、不擅自创建 Markdown
metadata:
  type: user
---
`;

const QODER_INDEX_LINE =
  '- [Engineering rules](engineering-rules.md) — 代码修改硬约束：先根因、限制定时器、少用 useEffect、注释精简、审查导入、按功能分目录、不擅自建 Markdown';

/** 直接写整块的文件型目标（SOUL / CLAUDE / AGENTS / GEMINI） */
const FILE_TARGETS = [
  { id: 'workbuddy', label: 'WorkBuddy',   detect: '.workbuddy',       file: '.workbuddy/SOUL.md' },
  { id: 'claude',    label: 'Claude Code', detect: '.claude',          file: '.claude/CLAUDE.md' },
  { id: 'codex',     label: 'Codex CLI',   detect: '.codex',           file: '.codex/AGENTS.md' },
  { id: 'gemini',    label: 'Gemini CLI',  detect: '.gemini',          file: '.gemini/GEMINI.md' },
  { id: 'opencode',  label: 'opencode',    detect: '.config/opencode', file: '.config/opencode/AGENTS.md' },
];

/** Qoder 走「记忆」体系：frontmatter 文件 + MEMORY.md 索引 */
const QODER_TARGET = {
  id: 'qoder',
  label: 'Qoder',
  detect: '.qoder',
  file: '.qoder/memory/engineering-rules.md',
  index: '.qoder/memory/MEMORY.md',
};

/** 只有应用内设置、没有文件通道的 agent */
const MANUAL_TARGETS = [
  { id: 'cursor',   label: 'Cursor',   where: 'Settings → Rules → User Rules' },
  { id: 'trae',     label: 'Trae',     where: '设置 → 规则 / Rules → 用户规则' },
  { id: 'windsurf', label: 'Windsurf', where: 'Settings → Cascade → Rules' },
];

/** 各 agent 存放 skill 的目录（均为 <base>/skills/<name>/SKILL.md 约定） */
const SKILL_BASES = [
  { id: 'workbuddy', label: 'WorkBuddy',   base: '.workbuddy' },
  { id: 'claude',    label: 'Claude Code', base: '.claude' },
  { id: 'codex',     label: 'Codex CLI',   base: '.codex' },
  { id: 'gemini',    label: 'Gemini CLI',  base: '.gemini' },
  { id: 'cursor',    label: 'Cursor',      base: '.cursor' },
  { id: 'trae',      label: 'Trae',        base: '.trae' },
  { id: 'qoder',     label: 'Qoder',       base: '.qoder' },
  { id: 'opencode',  label: 'opencode',    base: '.config/opencode' },
];

const abs = (rel) => join(HOME, rel);
const shown = (rel) => (rel.startsWith(HOME) ? `~${rel.slice(HOME.length)}` : rel);
const read = (path) => readFileSync(path, 'utf8');

/** WorkBuddy 除全局 SOUL.md 外，还会从个人档案目录读取同名的 SOUL.md；有则一并注入 */
function workbuddyProfileTargets() {
  const base = abs('.workbuddy');
  if (!existsSync(base)) return [];
  return readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith('user-'))
    .map((d) => `.workbuddy/${d.name}/SOUL.md`)
    .filter((rel) => statSync(abs(rel), { throwIfNoEntry: false })?.isFile())
    .map((rel, i) => ({ id: 'workbuddy', label: `WB 档案 ${i + 1}`, detect: '.workbuddy', file: rel }));
}

function parseArgs(argv) {
  const opts = { dryRun: false, list: false, all: false, print: false, only: null, linkSkill: false, copy: false, force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--list') opts.list = true;
    else if (arg === '--all') opts.all = true;
    else if (arg === '--print') opts.print = true;
    else if (arg === '--link-skill') opts.linkSkill = true;
    else if (arg === '--copy') opts.copy = true;
    else if (arg === '--force') opts.force = true;
    else if (arg === '--only') opts.only = (argv[i + 1] || '').split(',').map((s) => s.trim()).filter(Boolean), i += 1;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else throw new Error(`未知参数：${arg}（--help 查看用法）`);
  }
  return opts;
}

function rulesText() {
  if (!existsSync(RULES_PATH)) throw new Error(`规则正文不存在：${RULES_PATH}`);
  return read(RULES_PATH).trimEnd();
}

function buildBlock(text) {
  return `${BEGIN}\n${text}\n${END}`;
}

/** 标记块存在则原地替换，否则追加到文件末尾；返回 'created' | 'updated' | 'appended' */
function writeBlock(filePath, block, { dryRun }) {
  const existed = existsSync(filePath);
  const current = existed ? read(filePath) : '';
  if (!existed) {
    if (!dryRun) {
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, `${block}\n`, 'utf8');
    }
    return 'created';
  }
  const start = current.indexOf(BEGIN);
  if (start === -1) {
    if (!dryRun) writeFileSync(filePath, `${current.replace(/\s*$/, '')}\n\n${block}\n`, 'utf8');
    return 'appended';
  }
  const end = current.indexOf(END, start);
  const next = end === -1
    ? `${current.slice(0, start)}${block}\n`
    : `${current.slice(0, start)}${block}${current.slice(end + END.length)}`;
  if (!dryRun) writeFileSync(filePath, next, 'utf8');
  return 'updated';
}

/** Qoder：保留 frontmatter，正文写标记块，并在 MEMORY.md 登记索引 */
function writeQoder(target, block, { dryRun }) {
  const filePath = abs(target.file);
  const current = existsSync(filePath) ? read(filePath) : '';
  const hasFrontmatter = current.startsWith('---\n');
  let body = hasFrontmatter ? current : `${QODER_FRONTMATTER}\n${current}`;
  if (hasFrontmatter) {
    const start = body.indexOf(BEGIN);
    const end = start === -1 ? -1 : body.indexOf(END, start);
    body = start === -1
      ? `${body.replace(/\s*$/, '')}\n\n${block}\n`
      : `${body.slice(0, start)}${block}${body.slice(end + END.length)}`;
  } else {
    body = `${QODER_FRONTMATTER}\n${block}\n`;
  }

  const indexRel = target.index;
  const indexPath = abs(indexRel);
  const indexCurrent = existsSync(indexPath) ? read(indexPath) : '# Memory index\n';
  const needsIndex = !indexCurrent.includes('(engineering-rules.md)');
  const indexNext = needsIndex
    ? `${indexCurrent.replace(/\s*$/, '')}\n${QODER_INDEX_LINE}\n`
    : indexCurrent;

  if (!dryRun) {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, body, 'utf8');
    if (needsIndex) writeFileSync(indexPath, indexNext, 'utf8');
  }
  const state = hasFrontmatter ? 'updated' : 'created';
  return { state, indexed: needsIndex };
}

/** 把 skill 本体分发进各 agent 的 skills 目录：默认软链，--copy 改为复制 */
function linkSkillToAgents({ dryRun, copy, force, only }) {
  const src = resolve(HERE, '..');
  const name = src.split(/[\\/]/).filter(Boolean).pop();
  const results = [];

  for (const t of SKILL_BASES) {
    if (only && !only.includes(t.id)) continue;
    const base = abs(t.base);
    if (!existsSync(base)) {
      results.push({ label: t.label, path: shown(`${t.base}/skills/${name}`), state: 'skipped' });
      continue;
    }
    const skillsDir = join(base, 'skills');
    const target = join(skillsDir, name);
    const rel = `${t.base}/skills/${name}`;

    if (resolve(target) === src) {
      results.push({ label: t.label, path: shown(rel), state: 'self' });
      continue;
    }

    const lst = lstatSync(target, { throwIfNoEntry: false });
    const existing = !lst ? null : lst.isSymbolicLink() ? 'link' : 'dir';

    if (existing) {
      const pointsHere = existing === 'link' && resolve(skillsDir, readlinkSync(target)) === src;
      if (pointsHere) {
        results.push({ label: t.label, path: shown(rel), state: 'ok' });
        continue;
      }
      if (!force) {
        results.push({ label: t.label, path: shown(rel), state: 'exists' });
        continue;
      }
      if (!dryRun) rmSync(target, { recursive: true, force: true });
    }

    if (!dryRun) {
      mkdirSync(skillsDir, { recursive: true });
      if (copy) {
        cpSync(src, target, { recursive: true });
      } else {
        try {
          symlinkSync(src, target, 'dir');
        } catch {
          cpSync(src, target, { recursive: true });
        }
      }
    }
    results.push({ label: t.label, path: shown(rel), state: existing ? 'relinked' : 'linked' });
  }

  const mark = { linked: copy ? '复制' : '链接', relinked: '重建', ok: '已存在', self: '本体', exists: '跳过', skipped: '跳过' };
  process.stdout.write(`${dryRun ? '[dry-run] ' : ''}skill 分发结果\n`);
  for (const r of results) {
    const note = r.state === 'exists' ? '（已有其它内容，--force 覆盖）'
      : r.state === 'skipped' ? '（未检测到该 agent）' : '';
    process.stdout.write(`  ${mark[r.state].padEnd(4)} ${r.label.padEnd(12)} ${r.path}${note}\n`);
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const text = rulesText();

  if (opts.help) {
    process.stdout.write(
      '用法: node install.mjs [--dry-run] [--list] [--all] [--only id,id] [--print]\n' +
      '      node install.mjs --link-skill [--copy] [--force] [--dry-run]   把 skill 本体装进各 agent 的 skills 目录\n',
    );
    return;
  }
  if (opts.linkSkill) {
    linkSkillToAgents(opts);
    return;
  }
  if (opts.print) {
    process.stdout.write(`${text}\n`);
    return;
  }
  if (opts.list) {
    for (const t of [...FILE_TARGETS, ...workbuddyProfileTargets(), QODER_TARGET]) {
      const hit = existsSync(abs(t.detect)) ? '已检测到' : '未检测到';
      process.stdout.write(`${t.id.padEnd(10)} ${t.label.padEnd(12)} ${shown(abs(t.file)).padEnd(40)} ${hit}\n`);
    }
    for (const m of MANUAL_TARGETS) {
      process.stdout.write(`${m.id.padEnd(10)} ${m.label.padEnd(12)} 仅应用内设置：${m.where}\n`);
    }
    return;
  }

  const block = buildBlock(text);
  const wanted = (id) => !opts.only || opts.only.includes(id);
  const results = [];

  for (const t of [...FILE_TARGETS, ...workbuddyProfileTargets()]) {
    if (!wanted(t.id)) continue;
    const detected = existsSync(abs(t.detect));
    if (!detected && !opts.all) {
      results.push({ id: t.id, label: t.label, path: shown(abs(t.file)), state: 'skipped' });
      continue;
    }
    const state = writeBlock(abs(t.file), block, opts);
    results.push({ id: t.id, label: t.label, path: shown(abs(t.file)), state });
  }

  if (wanted(QODER_TARGET.id)) {
    const detected = existsSync(abs(QODER_TARGET.detect));
    if (!detected && !opts.all) {
      results.push({ id: QODER_TARGET.id, label: QODER_TARGET.label, path: shown(abs(QODER_TARGET.file)), state: 'skipped' });
    } else {
      const { state, indexed } = writeQoder(QODER_TARGET, block, opts);
      results.push({
        id: QODER_TARGET.id,
        label: QODER_TARGET.label,
        path: shown(abs(QODER_TARGET.file)),
        state,
        note: indexed ? '已登记 MEMORY.md 索引' : '索引已存在',
      });
    }
  }

  const mark = { created: '新增', updated: '更新', appended: '追加', skipped: '跳过' };
  const prefix = opts.dryRun ? '[dry-run] ' : '';
  process.stdout.write(`${prefix}工程规则注入结果\n`);
  for (const r of results) {
    const extra = r.note ? ` · ${r.note}` : '';
    const why = r.state === 'skipped' ? '（未检测到该 agent，--all 可强制创建）' : extra;
    process.stdout.write(`  ${mark[r.state].padEnd(4)} ${r.label.padEnd(12)} ${r.path}${why}\n`);
  }

  const manual = MANUAL_TARGETS.filter((m) => wanted(m.id));
  if (manual.length) {
    process.stdout.write('\n需手动粘贴（无文件通道）：\n');
    for (const m of manual) process.stdout.write(`  ${m.label.padEnd(10)} ${m.where}\n`);
    process.stdout.write('  规则正文：node install.mjs --print\n');
  }

  const touched = results.filter((r) => r.state !== 'skipped').length;
  process.stdout.write(`\n${opts.dryRun ? '预计改动' : '已改动'} ${touched} 个文件。重跑同一命令可安全更新。\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`失败：${error.message}\n`);
  process.exit(1);
}
