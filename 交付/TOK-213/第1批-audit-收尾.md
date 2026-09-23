# TOK-213 第 1 批：audit 试点收尾记录

## 范围与结果

- 试点目录：`ui/src/pages/audit`，共 7 个 TSX 文件；基线为 126 条可见英文文案。
- AST codemod 已在提交 `3f8380d73` 自动接入 114 条，自动处理率为 **90.48%**（114 / 126）。
- 本次补齐其余 12 条的运行时接线：模块级筛选/实体映射、导航标签、动态回退标签、空状态、toast、面包屑和 `*.production.tsx` 生产页面的同类路径。模块级数组仅保存 i18n 键，组件渲染期才调用 `t()`，因此切换语言时不会保留首次载入的文本。
- 中英文键值已补齐；`zh-CN.json` 的本批新增界面文案为中文，其他 38 个 locale 按 `en.json` 同步英文占位。键集为 1,311 个键、40 个 locale。

## 复验

| 项目 | 结果 |
| --- | --- |
| `node scripts/check-i18n-locales.mjs` | 通过：1,311 键，40 locale 无差异 |
| audit 相关 Vitest | 通过：4 文件、31 测试 |
| `pnpm check:token-gates` | 通过：4 个 gate 均 clean |
| `git diff --check` | 通过 |
| `pnpm exec tsc --noEmit -p ui/tsconfig.json` | 未通过：既有 `ui/src/pages/InstanceExperimentalSettings.test.tsx:71` fixture 缺少 `enableMcpAggregators`；本批未改该文件 |

## 浏览器证据

本轮只读请求 `http://127.0.0.1:3200/api/health` 返回连接失败；按 `PORT=3200 pnpm dev` 尝试启动隔离实例亦失败，原因为该 linked worktree 缺少 `.paperclip/.env`，开发服务器要求先运行 `paperclipai worktree init`。本席未执行初始化，以避免未经确认写入工作树运行配置；因此本轮没有伪造或复用旧截图。

浏览器截图与中文排版（截断、重叠、按钮宽度、换行）尚待已配置的隔离实例启动后完成。
