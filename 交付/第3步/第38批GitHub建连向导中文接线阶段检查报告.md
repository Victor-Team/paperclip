# 第38批 GitHub 建连向导中文接线阶段检查报告

日期：2026-09-25；工单：TOK-213；执行席：开发部·前端实现席；代码提交：`ec05d586d83d666c0f2f96b36a6dc7374624e4a4`。

## 范围与改动

- 处理 `ui/src/pages/apps/chat/GitHubChatSetup.tsx` 和 1 个定向测试。文件包含 8 步建连流程，面积接近单独大页面；该子目录只有 13 个生产 TSX，继第37批 GitHub 配置组件后继续此大文件，未凑 30 个文件。
- Codemod 接入 60 处 JSX/属性静态英文，手工补齐 8 步导航、面包屑、错误回退、空结果、toast、按钮与仓库状态，并修正注册过期时间后多余的 `t` 字符。智能体名称、步骤数、测试提及文本改为完整插值译文；时间格式跟随当前语言。
- en/zh 双语事实来源净增 88 键，其他 38 个 locale 由脚本重算。40 个 locale 各 11,248 键且键集一致。该页命名空间仅 `App ID` 是英／简中相同的技术标识；默认英文保持原值。
- 仅改本席 `pages/**` 源码与定向测试，以及所属命名空间的 en/zh 翻译；没有修改共享组件、共享脚本、后端或正式实例。

## 验证

- `pnpm exec vitest run ui/src/pages/apps/chat/GitHubChatSetup.i18n.test.tsx ui/src/pages/apps/chat/GitHubBotConfiguration.i18n.test.tsx ui/src/i18n`：3 文件、9/9 通过。新增测试核对向导首步导航、标题和说明随英／简中切换。
- `pnpm --filter @paperclipai/ui exec tsc -b --pretty false`、`node scripts/check-i18n-locales.mjs`、`pnpm check:token-gates` 四项及 `git diff --check` 均通过。本页 codemod 复扫 AST 可见英文候选 0。
- 隔离实例真实产品路由已采集桌面 1366×768、窄屏 390×844 的中文首步及智能体选择弹层、桌面英文对照。所拍状态页面异常 0、横向溢出 0；目视截断、重叠、按钮撑破 0。证据索引：`交付/TOK-213/浏览器证据/第38批/证据索引.md`。

## 尚未完成

- 步骤 2—8 需要创建和配置 GitHub App 才能进入；本批没有创建连接，也没有它们的浏览器双断点、有数据和失败态证据。服务端自由文本及原始 GitHub 设置提示词仍可能是英文，须随全站范围继续核对。
- 真实首步仍显示 `ui/src/components/SetupWizard.tsx` 的英文 `Save & exit`。这是并行席负责的共享组件，本席未越界修改；交负责人统筹该文件责任席处理。
- 未与设计稿对照，未经过独立席位复核；本批不作为 `apps/chat` 子目录或全站放行。默认 `pnpm paperclipai run` 的隔离 doctor 缺 `cli/install.json` 问题未解决，本轮以 `pnpm dev:once` 取证。
