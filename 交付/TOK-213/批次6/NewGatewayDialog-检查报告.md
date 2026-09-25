# TOK-213 第 6 批：创建网关对话框检查报告

日期：2026-09-24

## 本切片范围

- `ui/src/pages/apps/gateways/NewGatewayDialog.tsx`
- `ui/src/i18n/locales/{en,zh-CN}.json`，并由生成脚本同步其余 38 个 locale 的键集。

## 接线结果

- 网关创建成功与失败 toast、标题、说明、名称、访问配置、加载与空配置提示、描述、占位符和提交操作均通过 `t()` 读取。
- 外部访问配置名称、网关名称和服务端错误文本保持原值。
- AST 复扫为 0 候选。

## 验证

| 检查 | 结果 |
| --- | --- |
| `node scripts/check-i18n-locales.mjs` | 通过；40 个 locale 各 3,902 键，键集与 `en.json` 一致。 |
| 定向测试 | 未找到 `NewGatewayDialog` 同名 Vitest 文件。 |
| `pnpm check:token-gates` | 通过；四项 Gate 均为 CLEAN。 |
| `git diff --check` | 通过。 |
| `pnpm --filter @paperclipai/ui typecheck` | 未通过，但仅报既有 `ui/src/pages/InstanceExperimentalSettings.test.tsx:71` 缺少 `enableMcpAggregators`；本切片未新增诊断。 |

## 后续

继续处理网关活动、概览、高级和令牌面板中的可见文案。
