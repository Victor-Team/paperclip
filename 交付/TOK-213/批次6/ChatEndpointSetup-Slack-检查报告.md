# TOK-213 第 6 批 ChatEndpointSetup Slack 设置检查报告

## 范围

- 源码：`ui/src/pages/apps/chat/ChatEndpointSetup.tsx`
- 语言：`ui/src/i18n/locales/*.json`
- 实现提交：`3ced32068`（`feat(i18n): localize slack setup`）

本切片将 Slack 应用的初始连接、重新连接、清单复制、命令说明、配置字段、Webhook 前提、测试入口和完成设置路径接入 i18n。富文本说明通过 `Trans` 保留加粗与代码标记；Slack 产品名、OAuth 字段名、斜杠命令、清单内容、URL 及动态命令值保持原值。

## 验证

- `node scripts/generate-i18n-locales.mjs --copy-en-values` 后，`node scripts/check-i18n-locales.mjs` 通过：40 个 locale 与英文键集一致，共 3,780 键。
- `node scripts/i18n-codemod.mjs --directory ui/src/pages/apps/chat/ChatEndpointSetup.tsx` 复扫：Slack 设置段无残余候选；全文件余下 9 条候选，均属于下一切片的跨提供商会话测试界面，另有 BotFather 规定的 `bot` 后缀字面量。
- `pnpm --filter @paperclipai/ui exec vitest run src/pages/apps/chat/ChatEndpointSetup.state.test.ts`：1 个测试文件、3/3 通过。
- `pnpm check:token-gates`：四项均为 `CLEAN`。
- `git diff --check`：通过。
- `pnpm --filter @paperclipai/ui typecheck` 仍只报已有诊断：`ui/src/pages/InstanceExperimentalSettings.test.tsx:71` 的 `enableMcpAggregators` 缺失；本切片未新增类型诊断，因此不以此命令作为通过项。

## 结论与后续

Slack 设置段已完成本切片接线；这不构成 ChatEndpointSetup 全页或第 6 批的浏览器、目录或整机放行。下一续接处理跨提供商会话测试流程与身份访问提示。
