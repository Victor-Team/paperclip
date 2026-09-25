# TOK-213 第 6 批 Connections 汉化检查报告

## 范围

- 提交：`626545536 feat(i18n): localize connections overview copy`
- 源码：`ui/src/pages/apps/Connections.tsx`
- 语言文件：`ui/src/i18n/locales/en.json`、`ui/src/i18n/locales/zh-CN.json` 及其余 38 个键集同步文件

## 已完成

- 将 Connections 概览的页面标题、筛选项、表头、状态、操作按钮、辅助提示、空态、连接删除对话框、Cloud 注册横幅和成功／失败 toast 接入 `t()`。
- 删除确认和连接数量文案使用插值键；应用名、服务名、账户数据、错误详情和路由参数保持动态原值。
- 复扫 `Connections.tsx` 的 AST 候选，结果为 0 条可自动接线残余。

## 验证

| 检查 | 结果 |
| --- | --- |
| `node scripts/check-i18n-locales.mjs` | 通过：40 个 locale、3,345 个键一致 |
| `pnpm vitest run ui/src/pages/apps/Connections.test.tsx` | 通过：1 文件、7/7 测试 |
| `pnpm check:token-gates` | 通过：四项 CLEAN |
| `git diff --check` | 通过 |

## 未执行

- 本切片未重跑浏览器取证或全仓库 typecheck/build；前者在第 6 批已有独立证据，后者不属于该页面的定向回归范围。
