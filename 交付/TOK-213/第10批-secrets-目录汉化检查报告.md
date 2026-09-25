# TOK-213 第10批：`pages/secrets` 目录汉化检查报告

## 范围与提交

- 提交：`c8aa618d2`（`feat(i18n): localize secrets pages`）
- 页面范围：`ui/src/pages/secrets/**` 的 9 个可渲染 TSX 文件；未修改 `ui/src/pages/apps/**`、`ui/src/components/**`、`ui/src/context/**`、`ui/src/features/**`、`ui/src/adapters/**` 或 `ui/src/plugins/**`。
- 接线：169 条可见英文候选全部接入 `t()`；AST 复扫为 0 条。
- locale：新增本批页面命名空间键（包含完整插值句），`en.json` 与 `zh-CN.json` 为手写事实源；其余 38 个语言包由 `scripts/generate-i18n-locales.mjs --copy-en-values` 生成。

## 中文与术语

- 已复用 40 条已落地中文；其余固定可见文案按术语表回填中文。
- `secret` 译为“机密”，`provider` 译为“提供商”，`agent` 译为“智能体”；`AWS`、`ARN`、`IAM`、`Paperclip`、路径和标识符保持原文。
- 英文复数和句片段已改为完整插值键，避免中文语序或字面拼接残留。

## 验证

| 检查 | 结果 |
| --- | --- |
| AST 目录复扫 | 9 个文件、0 条候选 |
| locale 键集 | 40 个 locale、6,242 键，全部一致 |
| 定向 Vitest | 5 个文件、37 项通过 |
| UI typecheck | `tsc -b` 通过 |
| Token Gate | 四项 CLEAN |
| `git diff --check` | 通过 |

## 证据边界

本批未变更语言切换器、路由或布局，因此按分级复验采用类型与测试门禁；未声称完成浏览器整机复验。全量页面完成后再统一执行隔离实例中文／英文切换与断点截图复验。
