# TOK-213 第44批 Slack 命令说明完整译句检查报告

日期：2026-09-25。执行席：开发部·前端实现席。代码提交：`3463a39588ad7c54324bb9febdacd03e8e575082`。本批 1 轮，平台 token 用量待平台核算。

## 范围与改动

- 仅改本席 `ui/src/pages/apps/chat/ChatEndpointDetail.tsx`、一个定向测试及 40 个语言包；不改共享组件、后端、生成脚本和默认语言。聊天目录只有 13 个生产 TSX，本批专门修复同一连接详情中的命令示例，未凑 30 个文件。
- 连接标题改为完整插值译句。Slack 命令帮助由多个英文碎片拼接改为一个带 `<code>` 标记的完整译句。`status`、`new`、`close` 是可执行控制词，在英语和简中界面均保留原文；“investigate this”是自由输入的示例消息，中文可显示“调查此事”。
- 清理该页 9 个碎片键，新增 2 个完整键，净减 7 键。40 个 locale 各 11,340 键且键集与 `en.json` 一致；其余 38 个语言包仍是英文占位值，不声称完成这些语种的翻译。

## 验证

- `pnpm --dir ui exec vitest run src/pages/apps/chat`：13 个文件、114/114 通过。新增渲染测试对英语和简中均核对五个 `<code>` 示例：可自由输入的示例消息随语言变化，`/paperclip status`、`/paperclip new`、`/paperclip close` 和 Slack 原生 `/status` 保持可执行原文。
- `pnpm --dir ui exec tsc -b`、`node scripts/check-i18n-locales.mjs`、`pnpm check:token-gates` 和 `git diff --check` 通过；Token Gate 四项 CLEAN。新增键的英／简中插值参数与标签一致。该生产文件 AST 复扫，可见英文候选 0。

## 浏览器证据与未决项

该命令说明只在已配置 Slack 端点的连接详情出现；隔离数据没有可进入的已配置端点。本批没有该状态的真实路由桌面 1366×768 和窄屏 390×844 截图。服务端端点数据、设计稿对照与独立席位复核尚未完成。组件渲染测试不替代浏览器布局检查；本批不作为聊天目录或全站放行。
