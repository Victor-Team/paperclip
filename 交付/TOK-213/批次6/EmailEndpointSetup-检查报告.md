# TOK-213 第 6 批 EmailEndpointSetup 检查报告

## 范围

- `ui/src/pages/apps/chat/EmailEndpointSetup.tsx`
- 提交：`3cd2aec04 feat(i18n): localize email endpoint setup`

此切片将电子邮件端点的连接、权限、收件箱选择、接收方式、低信任提示、信任设置、状态和操作文案接入 i18n。原有自动扫描识别的 69 条文案全部接线；另补齐扫描器未覆盖的步骤标签、可访问性标签、搜索与空态、动态智能体名插值及低信任说明。动态智能体名、收件箱地址、服务端状态、时间、错误详情、路由参数与 AgentMail 域名仍保持原值。

## 验证

| 检查 | 结果 |
| --- | --- |
| `node scripts/check-i18n-locales.mjs` | 通过：40 个 locale、3,634 键一致 |
| `EmailEndpointSetup.tsx` AST 复扫 | 通过：0 条候选 |
| `pnpm check:token-gates` | 通过：四项 CLEAN |
| `git diff --check` | 通过 |
| `pnpm --filter @paperclipai/ui typecheck` | 未通过：既有 `ui/src/pages/InstanceExperimentalSettings.test.tsx:71` 缺少 `enableMcpAggregators`；本次文件未产生额外诊断 |

未找到与该组件同名的定向 Vitest 文件，因此未将无关测试作为本切片通过项。

## 后续

此切片不构成第 6 批目录级、浏览器级或整机放行。下一切片处理 `ui/src/pages/apps/chat/ChatEndpointSetup.tsx`。
