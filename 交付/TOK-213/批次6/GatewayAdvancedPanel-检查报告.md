# TOK-213 第 6 批：网关高级面板检查报告

日期：2026-09-24

## 本切片范围

- `ui/src/pages/apps/gateways/panels/GatewayAdvancedPanel.tsx`
- `ui/src/i18n/locales/{en,zh-CN}.json`，并由生成脚本同步其余 38 个 locale 的键集。

## 接线结果

- 归档成功/失败提示、复制反馈、传输与认证字段标签、原始配置操作、危险区域、归档确认说明、无障碍标签和操作按钮均通过 `t()` 读取。
- 网关名称仅作为插值值；端点 URL、公开 ID、`streamable_http`、`bearer`、协议版本以及原始 JSON 配置均保持原值。
- AST 复扫为 0 候选。

## 验证

| 检查 | 结果 |
| --- | --- |
| `node scripts/check-i18n-locales.mjs` | 通过；40 个 locale 各 3,980 键，键集与 `en.json` 一致。 |
| `node scripts/i18n-codemod.mjs --directory ui/src/pages/apps/gateways/panels/GatewayAdvancedPanel.tsx` | 通过；0 个可接线候选。 |
| `pnpm check:token-gates` | 通过；四项 Gate 均为 CLEAN。 |
| `git diff --check` | 通过。 |
| `pnpm --filter @paperclipai/ui typecheck` | 未通过，但仅报既有 `ui/src/pages/InstanceExperimentalSettings.test.tsx:71` 缺少 `enableMcpAggregators`；本切片未新增诊断。 |

未找到 `GatewayAdvancedPanel` 同名定向 Vitest 文件。

## 后续

继续处理 `TokensPanel.tsx`，再复查网关目录中的共享可见摘要并做目录级验证。
