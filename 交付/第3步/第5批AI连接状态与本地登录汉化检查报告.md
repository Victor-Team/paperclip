# TOK-213 第 5 批 AI 连接状态与本地登录汉化检查报告

## 范围

- 文件：`ui/src/components/ai-connections/model.ts`、`useLocalAiLogin.ts`、相应生产调用组件及 `ui/storybook/prototypes` 的可进入连接页。
- 将连接方式、状态、无连接、兼容性、共享凭据和不可用提示改为由调用方按当前语言解析；本地登录的过期、检查失败和连接前置条件回退也已本地化。
- 服务端投影的 `unavailableReason`、提供商品牌、账户名称和 API 数据保持动态原值；连接选择、检查与登录逻辑未改。

## 键与译文

- 新增 21 个英／简中键。
- 运行 `node scripts/generate-i18n-locales.mjs --copy-en-values` 后，40 个 locale 的键集与 `en.json` 完全一致，共 2,776 键。

## 验证

| 项目 | 命令 | 结果 |
| --- | --- | --- |
| 定向组件测试 | `pnpm vitest run ui/src/components/ai-connections/model.test.ts ui/src/components/ai-connections/useLocalAiLogin.test.tsx ui/src/components/ai-connections/AiConnectionAuth.test.tsx --passWithNoTests` | 3 个文件、18 条通过 |
| locale 键集 | `node scripts/check-i18n-locales.mjs` | 2,776 键、40 locale 一致 |
| 设计令牌 | `pnpm check:token-gates` | 四项 CLEAN |
| 差异检查 | `git diff --check` | 通过 |
| UI 类型检查 | `pnpm exec tsc --noEmit -p ui/tsconfig.json` | 仅既有未触及 fixture `ui/src/pages/InstanceExperimentalSettings.test.tsx:71` 缺 `enableMcpAggregators` |

## 后续

本文件仅记录第 5 批的可回滚切片；第 5 批仍需扫描其余组件目录的模块级可见文案。全量范围完成前不宣称浏览器整机放行。
