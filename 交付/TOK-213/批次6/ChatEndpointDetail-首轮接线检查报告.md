# TOK-213 第 6 批 ChatEndpointDetail 首轮接线检查报告

## 本次范围

- 提交：`b7afb2a76 feat(i18n): localize chat endpoint detail copy`
- 文件：`ui/src/pages/apps/chat/ChatEndpointDetail.tsx`
- 处理：82 条 AST 可识别的可见文案，涵盖连接加载、设置、访问、会话、活动、确认框和操作按钮。

## 验证

| 检查 | 结果 |
| --- | --- |
| `node scripts/check-i18n-locales.mjs` | 通过：40 个 locale、3,427 个键一致 |
| `pnpm vitest run ui/src/pages/apps/chat/ChatEndpointDetail.activity.test.ts` | 通过：1 文件、35/35 测试 |
| `pnpm check:token-gates` | 通过：四项 CLEAN |
| AST 复扫 | 0 条可自动接线残余 |
| `git diff --check` | 通过 |

## 未完成项

该文件仍有扫描器未覆盖的字符串：动态复制结果、部分 toast、资源可用性与权限说明、顶部导航标签、生命周期说明和活动状态映射。它们尚未纳入本次提交，下一切片必须逐项接入，不能把本报告当作整页放行结论。
