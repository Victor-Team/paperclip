# TOK-213 第 6 批：网关活动面板检查报告

日期：2026-09-24

## 本切片范围

- `ui/src/pages/apps/gateways/panels/GatewayActivityPanel.tsx`
- `ui/src/i18n/locales/{en,zh-CN}.json`，并由生成脚本同步其余 38 个 locale 的键集。

## 接线结果

- 活动结果状态、客户端/应用/工具回退名、活动摘要、展开后的事实标签、脱敏参数和结果标签、说明、空态及翻页操作均通过 `t()` 读取。
- 事件主体、工具名、策略决定、错误信息、调用 ID、脱敏数据和耗时保持原值。
- AST 复扫为 0 候选。

## 验证

| 检查 | 结果 |
| --- | --- |
| `node scripts/check-i18n-locales.mjs` | 通过；40 个 locale 各 3,926 键，键集与 `en.json` 一致。 |
| `pnpm --filter @paperclipai/ui exec vitest run src/pages/apps/gateways/panels/GatewayActivityPanel.test.tsx` | 通过；2/2。 |
| `pnpm check:token-gates` | 通过；四项 Gate 均为 CLEAN。 |
| `git diff --check` | 通过。 |
| `pnpm --filter @paperclipai/ui typecheck` | 未通过，但仅报既有 `ui/src/pages/InstanceExperimentalSettings.test.tsx:71` 缺少 `enableMcpAggregators`；本切片未新增诊断。 |

## 后续

继续处理网关概览、高级和令牌面板中的可见文案。
