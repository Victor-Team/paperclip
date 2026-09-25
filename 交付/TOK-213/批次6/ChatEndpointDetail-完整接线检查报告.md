# TOK-213 第 6 批 ChatEndpointDetail 完整接线检查报告

## 范围

- 页面：`ui/src/pages/apps/chat/ChatEndpointDetail.tsx`
- 代码提交：`b7afb2a76 feat(i18n): localize chat endpoint detail copy`
- 收尾提交：`a77638b21 feat(i18n): complete chat endpoint detail copy`
- 本页首轮的 82 条 AST 可识别文案已接线；收尾覆盖首轮扫描器未识别的动态交互文案。

## 已覆盖内容

- 页面标题、页签面包屑、复制状态、资源可用性、无障碍标签与未找到任务的回退标签。
- 设置、访问与身份关联中的动态提示、确认链接、外部身份状态和权限说明。
- 活动页的回放、处理、暂停与恢复 toast；回调面状态；活动种类、详情标签、文件传输阶段和健康状态。
- 七类提供商的重新连接及移除影响说明。
- 所有新增英文键均有中文译文，并同步到其余 38 个现有 locale 键集。

## 验证

| 检查 | 结果 |
| --- | --- |
| `node scripts/check-i18n-locales.mjs` | 通过：40 个 locale、3,506 键一致 |
| `pnpm vitest run ui/src/pages/apps/chat/ChatEndpointDetail.activity.test.ts` | 通过：35/35 |
| `pnpm check:token-gates` | 通过：四项 CLEAN |
| `node scripts/i18n-codemod.mjs --directory ui/src/pages/apps/chat/ChatEndpointDetail.tsx` | 通过：0 条候选 |
| `git diff --check` | 通过 |
| `pnpm --filter @paperclipai/ui typecheck` | 未通过：既有 `ui/src/pages/InstanceExperimentalSettings.test.tsx:71` 缺少 `enableMcpAggregators`；该错误不在本页或 locale 改动中 |

## 结论与后续

`ChatEndpointDetail` 已完成本页范围的可见文案接线；动态提供商名称、帐户标签、人员名称、文件名、服务端错误详情和路由参数保留原值。该结论不构成第 6 批目录级、浏览器级或整机放行。下一切片继续处理 `ui/src/pages/apps/chat` 的其余端点组件。
