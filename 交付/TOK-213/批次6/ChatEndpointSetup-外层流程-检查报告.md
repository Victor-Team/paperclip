# TOK-213 第 6 批 ChatEndpointSetup 外层流程检查报告

## 范围

- `ui/src/pages/apps/chat/ChatEndpointSetup.tsx` 第 1–520 行的外层连接流程
- 提交：`e4f437571 feat(i18n): localize chat setup flow`

本子切片接入连接步骤栏、连接目的选择、智能体选择、连接失败提示、保存退出和对应 toast。含提供商名的句子使用插值键；提供商名称、错误详情、路由参数和服务端端点状态保持原值。

## 验证

| 检查 | 结果 |
| --- | --- |
| `pnpm --filter @paperclipai/ui exec vitest run src/pages/apps/chat/ChatEndpointSetup.state.test.ts` | 通过：3/3 |
| `node scripts/check-i18n-locales.mjs` | 通过：40 个 locale、3,658 键一致 |
| ChatEndpointSetup 外层流程 AST 复扫 | 通过：第 1–520 行为 0 条候选；全文件尚余 209 条提供商设置、安装指引与测试流程文案 |
| `pnpm check:token-gates` | 通过：四项 CLEAN |
| `git diff --check` | 通过 |
| `pnpm --filter @paperclipai/ui typecheck` | 未通过：既有 `ui/src/pages/InstanceExperimentalSettings.test.tsx:71` 缺少 `enableMcpAggregators`；本子切片未产生额外诊断 |

## 后续

此报告仅覆盖该大文件的外层连接流程，不构成文件级、目录级、浏览器级或整机放行。下一子切片处理 `ProviderConnectStep` 的 Discord 与 Telegram 设置引导。
