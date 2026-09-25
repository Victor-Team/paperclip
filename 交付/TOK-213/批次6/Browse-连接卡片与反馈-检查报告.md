# 第 6 批 Apps Browse 连接卡片与反馈检查报告

日期：2026-09-24

## 范围

- `ui/src/pages/apps/Browse.tsx`
- `ui/src/i18n/locales/en.json`
- `ui/src/i18n/locales/zh-CN.json`，及由英文基准生成的其余 38 个语言包

本切片将 Browse 页的连接状态、连接器操作、删除确认与反馈、聊天端点摘要、面包屑、无障碍标签和原生聊天提供商说明接入 i18n。

## 保留原值

- 外部产品和提供商名称（如 Slack、GitHub、Discord、Microsoft Teams、Telegram、iMessage Photon）仍使用产品名。
- 帐户名、智能体名、服务端错误、提供商身份和端点字段仍由运行时数据提供，不被翻译或缓存。
- Telegram BotFather 所规定的 `bot` 用户名后缀不在此文件中改写。

## 验证

| 检查 | 结果 |
| --- | --- |
| `node scripts/generate-i18n-locales.mjs --copy-en-values` | 已生成其余语言包 |
| `node scripts/check-i18n-locales.mjs` | 40 个语言包键集一致，共 4,109 键 |
| `pnpm --filter @paperclipai/ui exec vitest run src/pages/apps/Browse.test.tsx` | 1 个文件、8/8 通过 |
| `node scripts/i18n-codemod.mjs --directory ui/src/pages/apps/Browse.tsx` | 0 个可见英文候选 |
| `pnpm check:token-gates` | 四项 CLEAN |
| `git diff --check` | 通过 |
| `pnpm --filter @paperclipai/ui typecheck` | 仅现有 `InstanceExperimentalSettings.test.tsx:71` 缺少 `enableMcpAggregators`；本切片未新增诊断 |

## 提交

- 代码：`d388cb185` `Localize apps browse connection feedback`

## 后续

继续处理 `ui/src/pages/apps/AppDetail.tsx` 与共享连接身份辅助函数中的可见文案，然后重新扫描 Apps 顶层目录。
