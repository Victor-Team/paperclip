# TOK-213 第 6 批 ChatEndpointSetup GitHub App 检查报告

## 范围

- 源码：`ui/src/pages/apps/chat/ChatEndpointSetup.tsx`
- 语言：`ui/src/i18n/locales/*.json`
- 实现提交：`86edae172`（`feat(i18n): localize github app setup`）

本切片将 GitHub App 的创建与重新连接说明、五步配置引导、Webhook URL 与密钥、私钥文件输入、复制与状态反馈、HTTPS 前提和连接操作接入 i18n。富文本引导继续通过 `Trans` 保留加粗与代码标记；GitHub 事件名、权限名、URL、文件扩展名与外部产品名称保持原值。动态 App 数据、凭据和服务端错误详情未被翻译或改写。

## 验证

- `node scripts/generate-i18n-locales.mjs --copy-en-values` 后，`node scripts/check-i18n-locales.mjs` 通过：40 个 locale 与英文键集一致，共 3,755 键。
- `node scripts/i18n-codemod.mjs --directory ui/src/pages/apps/chat/ChatEndpointSetup.tsx` 复扫：GitHub App 段无残余候选；全文件尚有 50 条候选，均属于下一切片的 Slack 设置或会话测试流程，另有 BotFather 规定的 `bot` 后缀字面量。
- `pnpm --filter @paperclipai/ui exec vitest run src/pages/apps/chat/ChatEndpointSetup.state.test.ts`：1 个测试文件、3/3 通过。
- `pnpm check:token-gates`：四项均为 `CLEAN`。
- `git diff --check`：通过。
- `pnpm --filter @paperclipai/ui typecheck` 仍只报已有诊断：`ui/src/pages/InstanceExperimentalSettings.test.tsx:71` 的 `enableMcpAggregators` 缺失；本切片未新增类型诊断，因此不以此命令作为通过项。

## 结论与后续

GitHub App 设置引导已完成本切片接线；这不构成 ChatEndpointSetup 全页或第 6 批的浏览器、目录或整机放行。下一续接处理 Slack 设置与会话测试流程。
