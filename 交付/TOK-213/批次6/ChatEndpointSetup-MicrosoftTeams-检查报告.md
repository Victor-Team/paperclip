# TOK-213 第 6 批 ChatEndpointSetup Microsoft Teams 检查报告

## 范围

- `ui/src/pages/apps/chat/ChatEndpointSetup.tsx` 的 Microsoft Teams 设置引导
- 提交：`1daefd8c0 feat(i18n): localize teams setup guide`

本子切片接入 Teams 连接和重连说明、组织限制、三步设置指引、门户字段映射、应用清单、RSC 权限、文件限制、HTTPS 前提、复制反馈和操作按钮。门户中的产品名称、字段名、权限名、代码字段与外部 URL 保持原值；智能体名称使用插值键。富文本翻译保留原有的加粗字段和代码样式。

## 验证

| 检查 | 结果 |
| --- | --- |
| `pnpm --filter @paperclipai/ui exec vitest run src/pages/apps/chat/ChatEndpointSetup.state.test.ts` | 通过：3/3 |
| `node scripts/check-i18n-locales.mjs` | 通过：40 个 locale、3,719 键一致 |
| ChatEndpointSetup Microsoft Teams AST 复扫 | 通过：Teams 段为 0 条候选；全文件尚余 102 条 GitHub、Slack 与测试流程候选，以及 BotFather 要求的 `bot` 代码字面量。 |
| `pnpm check:token-gates` | 通过：四项 CLEAN |
| `git diff --check` | 通过 |
| `pnpm --filter @paperclipai/ui typecheck` | 未通过：既有 `ui/src/pages/InstanceExperimentalSettings.test.tsx:71` 缺少 `enableMcpAggregators`；本子切片未产生额外诊断 |

## 后续

此报告仅覆盖 Microsoft Teams 设置引导，不构成文件级、目录级、浏览器级或整机放行。下一子切片处理 GitHub App 设置引导。
