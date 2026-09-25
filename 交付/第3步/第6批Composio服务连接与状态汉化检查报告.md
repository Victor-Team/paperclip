# 第6批 Composio 服务连接与状态汉化检查报告

日期：2026-09-24

## 范围

本切片处理 `ui/src/pages/apps/app-detail/ServicesPanel.tsx` 的 Composio 服务页固定可见文案：加载与空态、连接／重连／断开、状态徽标、授权回退、服务说明、权限入口、服务断开确认及 toast。

Composio、服务名、工具包 slug、动态账号状态、服务端错误和授权跳转目标保持为动态输入；轮询、连接、重查、断开、缓存失效和跳转逻辑未改。

## 验证

- `node 交付/第3步/sync-locale-keys.mjs` 后，`node scripts/check-i18n-locales.mjs` 通过：40 个 locale 与英语键集一致，共 3,048 键。
- `pnpm vitest run ui/src/pages/apps/app-detail/ServicesPanel.render.test.tsx --passWithNoTests`：1 个文件、10 条通过。覆盖既有服务状态行为，以及简体中文“未连接”和“连接”操作。
- `pnpm check:token-gates`：四项 CLEAN。
- `git diff --check`：通过。
- `pnpm exec tsc --noEmit -p ui/tsconfig.json` 仍只报既有未触及 fixture `ui/src/pages/InstanceExperimentalSettings.test.tsx:71` 缺少 `enableMcpAggregators`；本切片未新增类型错误。

## 已知边界

- `pages/apps` 目录仍有其他组件待处理；本报告不声明目录完成。
- 最小种子环境无法解析应用路由所需的组织前缀，故本切片不将该页面作为浏览器或整机放行证据。
