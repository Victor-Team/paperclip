# TOK-213 第 6 批 AppDetail 汉化检查报告

- 提交：`1c9e7e57f`。
- 范围：`ui/src/pages/apps/AppDetail.tsx` 的 15 条 AST 可见文案，涵盖组织空态、未找到应用、重试、重命名、操作计数、加载与工具失败状态。
- 语言：`en.json` 保留原英文，`zh-CN.json` 接入对应中文；locale 生成器已同步全部 40 个语言文件，键集为 3,166。
- 工具修正：codemod 现在会识别组件内已有的 `useTranslation()`，不再重复注入 `t` 声明；本次 AppDetail 编译失败由该修正消除。

## 验证

| 检查 | 结果 |
| --- | --- |
| `pnpm vitest run ui/src/pages/apps/AppDetail.test.tsx` | 59/59 通过 |
| `node scripts/check-i18n-locales.mjs` | 40 locale、3,166 键一致 |
| `pnpm check:token-gates` | 四项 CLEAN |
| `git diff --check` | 通过 |

本切片是已登记的 37 文件 `pages/apps` 第 6 批中的第一组接线，不构成目录完成、浏览器放行或整机放行结论。
