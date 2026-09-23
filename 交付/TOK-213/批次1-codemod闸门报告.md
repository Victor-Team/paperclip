# TOK-213 第 1 批 · audit codemod 闸门报告

日期：2026-09-23  
范围：`ui/src/pages/audit` 的 7 个生产 `.tsx` 文件（不含测试）

## 结论

**未通过 70% 自动处理率闸门，已停止源码接线。**

本轮没有改动 `ui/src/pages/audit` 或任一 locale 的业务内容。已提交的工具基线是
`0cef35b59`；本报告对应的增量将在后续提交中保存。

## 可复现命令与结果

```sh
node scripts/i18n-codemod.mjs --directory ui/src/pages/audit --expected 126
```

输出摘要：

| 指标 | 数值 |
| --- | ---: |
| 扫描文件 | 7 |
| 本批既定可见文案基线 | 126 |
| 可由当前 codemod 安全处理的静态 JSX／属性文案 | 74 |
| 仍需人工或更强 AST 规则处理 | 52 |
| 自动处理率 | **58.73%** |

`node scripts/check-i18n-locales.mjs` 同时通过：`en.json` 的 1,126 个键在 40 个 locale 中键集一致。

## 当前工具与未覆盖类型

本批新增三个零依赖脚本：

- `scripts/i18n-codemod.mjs`：盘点静态 JSX 文本及 `placeholder`、`title`、`aria-label`、`alt`、`label` 属性，并以基线总数计算处理率；
- `scripts/generate-i18n-locales.mjs`：以 `en.json` 为键结构同步所有 locale；
- `scripts/check-i18n-locales.mjs`：严格检查所有 locale 的缺键与多键。

脚本刻意不猜测以下类型，因此这 52 条不能算作“自动处理”：模块级标签数组、函数内返回的字符串、条件/枚举映射、模板或插值字符串、动态状态值与代码标识符。把它们直接替换成 `t()` 会改变作用域、反应式语言切换或运行时参数语义。

## 需要裁定

按本单第 8.2 节，自动率低于 70% 时不能硬推。需要 CEO 裁定以下之一：

1. 允许引入/使用可用的 AST codemod 依赖或工具，以覆盖上述五类语法后重跑试点；或
2. 允许本席为这 52 条补充专用、经测试的转换规则后重跑（不引入依赖，但工具实现范围扩大）。

在裁定前，不应把英文占位值写入 `zh-CN.json`，也不应半自动改写 audit 源码。
