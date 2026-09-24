# TOK-213 第 6 批 身份确认与 Photon 设置检查报告

## 范围

- `ui/src/pages/apps/chat/ChatIdentityConfirm.tsx`
- `ui/src/pages/apps/chat/PhotonConnectStep.tsx`
- 提交：`668f80086 feat(i18n): localize identity and photon setup`

两份组件共 40 条 AST 可识别可见文案已接入 i18n：身份链接校验与确认、提供商和帐户标签、Photon 项目检查、线路分配、操作状态及连接提示。Photon 的混合文本改用单一插值键，避免翻译后出现无效分隔字符。

## 验证

| 检查 | 结果 |
| --- | --- |
| `node scripts/check-i18n-locales.mjs` | 通过：40 个 locale、3,548 键一致 |
| 两份组件的 AST 复扫 | 通过：均为 0 条候选 |
| `pnpm check:token-gates` | 通过：四项 CLEAN |
| `git diff --check` | 通过 |
| `pnpm --filter @paperclipai/ui typecheck` | 未通过：既有 `ui/src/pages/InstanceExperimentalSettings.test.tsx:71` 缺少 `enableMcpAggregators`；本次文件未产生额外诊断 |

这两份组件没有同名定向 Vitest 文件。动态提供商名、外部身份、项目名、电话号码和服务端不可用原因保持原值。

## 后续

此切片不构成第 6 批目录级、浏览器级或整机放行。下一切片继续处理 `ChatEndpointSetup.tsx` 或 `EmailEndpointSetup.tsx`。
