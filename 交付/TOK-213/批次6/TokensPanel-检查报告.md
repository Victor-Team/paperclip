# 第6批 网关令牌面板检查报告

日期：2026-09-24

## 范围

- `ui/src/pages/apps/gateways/panels/TokensPanel.tsx`
- `ui/src/i18n/locales/en.json`
- `ui/src/i18n/locales/zh-CN.json`，以及由基准英文同步的其余 38 个语言包

## 接线结果

- 令牌状态、过期状态、签发与撤销反馈、复制反馈、运行时令牌说明、签发表单、新令牌提示、历史表格/移动卡片、分页和撤销确认均改用 `t()`。
- 令牌名称、令牌值、客户端名称、所有者备注、日期/相对时间、服务端错误和审计数据保持运行时原值；撤销提示只对令牌名称使用插值。
- 令牌状态改为在本面板映射 i18n 键，避免将共享辅助函数的英文标签带入本页面。

## 验证

| 检查 | 结果 |
| --- | --- |
| `node scripts/check-i18n-locales.mjs` | 通过：40 个语言包均为 4,030 键 |
| `node scripts/i18n-codemod.mjs --directory ui/src/pages/apps/gateways/panels/TokensPanel.tsx` | 通过：0 条可见英文候选 |
| `pnpm --filter @paperclipai/ui exec vitest run src/pages/apps/gateways/panels/TokensPanel.test.tsx` | 通过：1 文件、4 测试 |
| `pnpm check:token-gates` | 通过：四项 CLEAN |
| `git diff --check` | 通过 |
| `pnpm --filter @paperclipai/ui typecheck` | 受既有 `ui/src/pages/InstanceExperimentalSettings.test.tsx:71` 缺少 `enableMcpAggregators` 阻断；本切片未新增诊断 |

## 后续

复查 `gateway-helpers.ts` 中供其他面板使用的可见状态摘要，再处理 `AppsToolsPanel.tsx` 的剩余可见文本，并做网关目录级扫描与汇总验证。
