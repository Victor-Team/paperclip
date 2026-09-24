# 第 12 批 · skills 目录汉化检查报告

- 工单：[TOK-213](/TOK/issues/TOK-213)
- 日期：2026-09-24
- 实现席：开发部·前端实现席
- 代码提交：`581a0aed5`（分支 `feat/anc-zh-cn`）
- 边界：仅 `ui/src/pages/skills/ImportSkillsFromProjectDialog.tsx`、对应测试与 40 个 locale；未改并行席目录和共享脚本。

## 本批结果

| 项 | 实际结果 |
|---|---|
| 可渲染文件 | 1 个：项目技能导入对话框；目录中的其余文件是工具函数和测试 |
| 自动接线 | 63/63 条 AST 候选接线，目录复扫 0 |
| 动态文案 | 导入数量及单复数、toast、错误回退、工作区数量／来源类型、筛选空态和技能选择／重命名的 `aria-label` 改为渲染期翻译；不用 `skill` + `s` 等碎片拼句 |
| 语言包 | 新增 92 个英／简中键；40 个 locale 各 6,531 键，键集一致；其余 38 个用英文占位 |

按本单 §8.3「一批一个目录」执行。此目录只有一个可渲染文件，因此不足 30 个文件；没有跨入其他目录凑数。

## 定向验证

- `node scripts/check-i18n-locales.mjs`：通过，40 个 locale 各 6,531 键。
- `node scripts/i18n-codemod.mjs --directory ui/src/pages/skills`：可见英文候选 0。
- `pnpm vitest run ui/src/pages/skills/ImportSkillsFromProjectDialog.test.tsx ui/src/pages/skills/skills-navigation.test.ts ui/src/i18n/locale-validation.test.ts`：3 个文件，28/28 通过。新增用例核对英文单复数与中文数量、筛选文案。
- `pnpm --dir ui exec tsc -b --pretty false`：通过。
- `pnpm check:token-gates`：四项 CLEAN。
- `git diff --check`：通过。

本批未起隔离浏览器实例，不声称完成两套断点排版或整站验收；按本单 §8.2 留待全量后的独立整机复验。项目名、技能名与描述、文件路径、`SKILL.md` 文件名、服务端候选原因／警告与错误原文按动态输入或代码标识原样显示。筛选值在中文整句中插值，避免误译用户输入。

## 本批处置

本报告只记录实现席自验，不构成独立复核或放行。后续在原单继续处理根目录页面已接线但尚为英文回退的条目；并行目录遵守本单 §九边界。
