# 第6批 Railway 容器访问汉化检查报告

日期：2026-09-24  
范围：`ui/src/pages/apps/app-detail/RailwayAccessPanel.tsx`、`RailwayAccessPanel.test.tsx`

## 本轮变更

- Railway 容器访问的固定引导、授权账户标签、SSH 密钥／主机密钥操作、状态说明和本地错误回退均改为当前语言在渲染期解析。
- Railway 服务端 API 说明、SSH 公钥、known_hosts 值和变更操作错误保持动态原值；生成、启用、移除密钥的业务逻辑没有变更。
- 新增 23 个英／简中键；其余 38 个 locale 由既有同步脚本补齐英文后备值。40 个 locale 键集现为 2,940 键。

## 验证

- `pnpm vitest run ui/src/pages/apps/app-detail/RailwayAccessPanel.test.tsx --passWithNoTests`：1 个文件、4 条通过。新增用例断言简体中文“Railway 操作”“容器访问”和“已验证的 Railway 主机密钥”。
- `node scripts/check-i18n-locales.mjs`：40 个 locale 与 `en.json` 完全同键，共 2,940 键。
- `pnpm check:token-gates`：四项 Gate 均为 CLEAN。
- `git diff --check`：通过。
- `pnpm exec tsc --noEmit -p ui/tsconfig.json`：仅重现未触及 fixture `ui/src/pages/InstanceExperimentalSettings.test.tsx:71` 缺少 `enableMcpAggregators`；本切片未新增类型错误。

## 已知边界

- `pages/apps` 的其他连接详情和配置组件仍在第 6 批连续范围内；本报告不宣称目录或全站完成。
- 本轮未进行应用页浏览器验证：隔离最小种子的应用路由受组织前缀数据限制。本报告不作浏览器或整机放行声明。
