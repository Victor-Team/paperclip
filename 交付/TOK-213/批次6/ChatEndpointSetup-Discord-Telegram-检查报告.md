# TOK-213 第 6 批 ChatEndpointSetup Discord 与 Telegram 检查报告

## 范围

- `ui/src/pages/apps/chat/ChatEndpointSetup.tsx` 的 `ProviderConnectStep` 中 Discord 与 Telegram 设置引导
- 提交：`e3068d945 feat(i18n): localize discord and telegram setup`

本子切片接入 Discord 与 Telegram 的标题、重连说明、创建说明、设置步骤、字段标签、链接与操作按钮。智能体名称采用插值键；Discord、Telegram、BotFather、Application ID、Server ID、`/newbot`、`bot` 用户名后缀和 `/task@bot_username <request>` 均按协议或外部产品要求保持原值。

## 验证

| 检查 | 结果 |
| --- | --- |
| `pnpm --filter @paperclipai/ui exec vitest run src/pages/apps/chat/ChatEndpointSetup.state.test.ts` | 通过：3/3 |
| `node scripts/check-i18n-locales.mjs` | 通过：40 个 locale、3,686 键一致 |
| ChatEndpointSetup Discord 与 Telegram AST 复扫 | 通过：两段引导文案均为 0 条候选；`bot` 是 BotFather 要求的代码字面量，保留原值。全文件尚余 183 条 Microsoft、GitHub、Slack 与测试流程候选。 |
| `pnpm check:token-gates` | 通过：四项 CLEAN |
| `git diff --check` | 通过 |
| `pnpm --filter @paperclipai/ui typecheck` | 未通过：既有 `ui/src/pages/InstanceExperimentalSettings.test.tsx:71` 缺少 `enableMcpAggregators`；本子切片未产生额外诊断 |

## 后续

此报告仅覆盖 Discord 与 Telegram 设置引导，不构成文件级、目录级、浏览器级或整机放行。下一子切片处理 Microsoft Teams 设置引导。
