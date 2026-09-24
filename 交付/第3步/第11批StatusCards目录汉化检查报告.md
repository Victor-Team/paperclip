# 第 11 批 · StatusCards 目录汉化检查报告

- 工单：[TOK-213](/TOK/issues/TOK-213)
- 日期：2026-09-24
- 实现席：开发部·前端实现席
- 代码提交：`b3ce497b8`（分支 `feat/anc-zh-cn`）
- 边界：仅 `ui/src/pages/StatusCards/**` 与 40 个 `ui/src/i18n/locales/*.json`。未修改并行席负责的组件、上下文、功能、适配器、插件及共享脚本。

## 本批结果

| 项 | 实际结果 |
|---|---|
| 可渲染文件 | 7 个：`index.tsx`、`StatusCardTile.tsx`、`StatusCardDetailDrawer.tsx`、`StatusCardSettingsForm.tsx`、`CreateStatusCardDialog.tsx`、`ArchivedStatusCardRow.tsx`、`SummarizerAgentSelect.tsx` |
| 自动接线 | 138/138 条 AST 候选，接线后同目录复扫为 0 |
| 中文补齐 | 新增 197 个英／简中键，含 138 条自动接线文案与 59 条动态句子、表单选项、错误回退及状态／费用格式文案 |
| 语言包 | 40 个 locale 各 6,439 键，键集一致；其余 38 个用英文占位 |
| 命名空间 | `index.tsx` 改用 `statuscards.general.*`，未占用并行分支的 `index.general.*` |
| 特殊处理 | 变更数量、归档数量、费用估计改为整句插值；中文时间、日期和词元单位按语言显示；菜单、对话框、抽屉、折叠高级设置中的标签同步接线 |

按 CEO 本单 §8.3「一批一个目录」执行。此目录仅有 7 个可渲染文件，不足 30 个文件；没有借此跨入别的目录。

## 定向验证

- `node scripts/check-i18n-locales.mjs`：通过，40 个 locale 各 6,439 键。
- `node scripts/i18n-codemod.mjs --directory ui/src/pages/StatusCards`：可见英文候选 0。
- `pnpm vitest run ui/src/pages/StatusCards/format.test.ts ui/src/pages/StatusCards/StatusCardTile.test.tsx ui/src/pages/StatusCards/StatusCardSettingsForm.test.tsx ui/src/i18n/locale-validation.test.ts`：4 个文件，30/30 通过；新增用例核对中文计数、词元单位、更新策略和成本提示。
- `pnpm --dir ui exec tsc -b --pretty false`：通过。
- `pnpm check:token-gates`：四项 CLEAN。
- `git diff --check`：通过。

本批未起隔离浏览器实例，因此没有声称完成浏览器截图、两套断点排版检查或整站验收。按本单 §8.2，整机复验集中在全量完成后；该项仍待独立放行席完成。动态输入（用户卡片标题与提示、智能体和工单名称、摘要正文、模型名、时区值、服务端返回的错误原文、查询 JSON）按原值显示；产品/协议及代码标识保留原文。`changeKind` 只有已知的「新工单符合查询／不再符合查询」做了固定翻译，未知服务端类型仍显示原始值，需在最终残留清单按实际值复核。

## 本批处置

这份报告记录实现席自验，不构成独立代码复核或全站放行。继续按原单范围处理 `ui/src/pages/skills` 与其余已放开的页面目录；`pages/apps/**` 仍由当前并行边界限制，等待负责人明确放开。
