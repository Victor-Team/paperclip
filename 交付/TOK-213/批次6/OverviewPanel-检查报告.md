# TOK-213 第 6 批：网关概览面板检查报告

日期：2026-09-24

## 本切片范围

- `ui/src/pages/apps/gateways/panels/OverviewPanel.tsx`
- `ui/src/i18n/locales/{en,zh-CN}.json`，并由生成脚本同步其余 38 个 locale 的键集。

## 接线结果

- 网关开关、无障碍标签、复制 toast、应用/令牌/健康统计、访问范围、配置文件、空态、客户端连接提示、工具数量和应用健康状态均通过 `t()` 读取。
- 数量文本保留英文单复数；中文采用对应的量词表达。
- 网关名称、配置文件名称、范围值、应用名称、端点 URL、令牌、协议头、应用关注原因和复制内容保持原值；`Authorization: Bearer` 仍是协议字面量。
- 概览页不再依赖 `gateway-helpers.ts` 中的英文工具数量摘要，而是将相同的配置文件计数规则在本组件中以 i18n 键呈现。
- AST 复扫为 0 候选。

## 验证

| 检查 | 结果 |
| --- | --- |
| `node scripts/check-i18n-locales.mjs` | 通过；40 个 locale 各 3,959 键，键集与 `en.json` 一致。 |
| `node scripts/i18n-codemod.mjs --directory ui/src/pages/apps/gateways/panels/OverviewPanel.tsx` | 通过；0 个可接线候选。 |
| `pnpm --filter @paperclipai/ui exec vitest run src/pages/apps/gateways/panels/GatewayActivityPanel.test.tsx` | 通过；同目录现有回归测试 2/2。未找到 `OverviewPanel` 的同名定向测试。 |
| `pnpm check:token-gates` | 通过；四项 Gate 均为 CLEAN。 |
| `git diff --check` | 通过。 |
| `pnpm --filter @paperclipai/ui typecheck` | 未通过，但仅报既有 `ui/src/pages/InstanceExperimentalSettings.test.tsx:71` 缺少 `enableMcpAggregators`；本切片未新增诊断。 |

## 后续

继续处理 `GatewayAdvancedPanel.tsx`，随后处理令牌面板，并在目录级验证前复查共享网关辅助函数的可见摘要。
