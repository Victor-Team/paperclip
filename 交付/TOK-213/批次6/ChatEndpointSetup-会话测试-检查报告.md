# TOK-213 第 6 批 ChatEndpointSetup 会话测试检查报告

## 范围

- 源码：`ui/src/pages/apps/chat/ChatEndpointSetup.tsx`
- 语言：`ui/src/i18n/locales/*.json`
- 实现提交：`47b51197a`（`feat(i18n): localize chat setup tests`）

本切片将跨提供商的真实会话测试流程、访客身份与访问权限提示、号码复制反馈和跳转操作接入 i18n。智能体名、外部账号、电话号码、机器人提及和提供商名称继续使用插值值；提供商名称与协议命令保持原值。

## 验证

- `node scripts/generate-i18n-locales.mjs --copy-en-values` 后，`node scripts/check-i18n-locales.mjs` 通过：40 个 locale 与英文键集一致，共 3,829 键。
- `node scripts/i18n-codemod.mjs --directory ui/src/pages/apps/chat/ChatEndpointSetup.tsx` 复扫：仅余 1 条 `bot`，它是 Telegram BotFather 规定的用户名后缀，不能翻译。
- `pnpm --filter @paperclipai/ui exec vitest run src/pages/apps/chat/ChatEndpointSetup.state.test.ts`：1 个测试文件、3/3 通过。
- `pnpm check:token-gates`：四项均为 `CLEAN`。
- `git diff --check`：通过。
- `pnpm --filter @paperclipai/ui typecheck` 仍只报已有诊断：`ui/src/pages/InstanceExperimentalSettings.test.tsx:71` 的 `enableMcpAggregators` 缺失；本切片未新增类型诊断，因此不以此命令作为通过项。

## 结论与后续

`ChatEndpointSetup.tsx` 的用户可见文案已完成接线；剩余 `bot` 是外部平台强制字面量。下一续接复查聊天端点目录其他文件，并为已完成的目录准备汇总验证。
