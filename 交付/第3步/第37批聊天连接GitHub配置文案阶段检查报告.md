# 第37批聊天连接 GitHub 配置文案阶段检查报告

日期：2026-09-25；工单：TOK-213；执行席：开发部·前端实现席；分支：`feat/anc-zh-cn`；代码提交：`bb1b447d913fece6e6dcff5fc2298a19d93ebfe8`。

## 范围与改动

- 本批处理 `ui/src/pages/apps/chat/**` 的 4 个生产 TSX：`ChatCommunicationInstructions.tsx`、`GitHubBotConfiguration.tsx`、`GitHubBotManagement.tsx`、`GitHubSetupPrompt.tsx`，另新增 1 个定向测试。该子目录只有 13 个生产 TSX，本批先完成 GitHub 配置和通用说明的内聚组件；其余 GitHub/Slack 建连向导仍待后续批次，故未凑 30 个文件。
- Codemod 对这 4 个文件检测到 103 处可见 JSX/属性英文并全部接入 `t()`。手工补齐事件、筛选说明、访问权限、操作反馈、动态负责人标签、审查状态与结论；修正 codemod 造成的评分项多余字符，改为带 `score` 插值的完整句子；覆盖数字统计改为带 `reviewed`、`omitted` 插值的完整句子。
- `en.json` 保留默认英文，`zh-CN.json` 增加对应简中；其余 38 个 locale 由现有生成脚本同步。相对第36批 11,008 键，本批净增 152 键，40 个 locale 均为 11,160 键。新命名空间英／简中自然语言相同值 0；`GitHub ID` 为技术标识而保留。
- 只修改本席 `pages/**` 源码、本批测试与自己负责的 en/zh 命名空间；38 个其他 locale 仅由脚本重算。未更改共享脚本、默认语言、并行席源文件及正式实例。

## 验证

- `node scripts/check-i18n-locales.mjs`：40 个 locale 键集一致，各 11,160 键。
- `pnpm exec vitest run ui/src/pages/apps/chat/GitHubBotConfiguration.i18n.test.tsx ui/src/pages/apps/chat/ChatEndpoint.clipboard.test.tsx ui/src/i18n`：3 文件、36/36 通过。新增测试覆盖事件、筛选、提示词无障碍标签和评分项在英／简中切换后的值。
- `pnpm --filter @paperclipai/ui exec tsc -b --pretty false` 通过；`pnpm check:token-gates` 四项 CLEAN；`git diff --check` 通过。Codemod 复扫这 4 个文件的 AST 可见英文候选 0。
- 隔离组件预览采集桌面 1366×768、窄屏 390×844 的简中默认态、展开态及桌面英文对照；页面异常 0，横向溢出 0，目视所拍状态的重叠、截断、按钮撑破 0。证据索引：`交付/TOK-213/浏览器证据/第37批/证据索引.md`。

## 尚未完成与范围限制

- `apps/chat` 其余生产组件仍有直写英文：GitHub 建连向导 60 处、Slack 身份与头像流程等至少 80 处；本批不作为该子目录或全站完成。
- 原始 GitHub 设置提示词及默认审查提示词是供智能体执行的英文内容，在复制失败帮助区可见，仍待按全站可见范围处理；本批只覆盖操作标签和状态。后续不能把这类可见内容无记录地豁免。
- 隔离数据库中无词元共振聊天端点，无法进入实际已配置 GitHub 机器人页面；浏览器证据仅为真实组件的静态预览。带数据、失败态、实际路由、语言切换刷新持久化、设计稿对照及独立席复核未核验。默认入口 `pnpm paperclipai run` 的隔离 doctor 缺 `cli/install.json` 问题仍在，本批使用隔离 `pnpm dev:once` 与 Vite 预览取证。

结论：本批源码与局部组件状态通过自查；不宣称独立验收或全站放行。下一步在本单继续 `pages/apps/chat/**` 其余可见文案。
