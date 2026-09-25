# 第 6 批 AppDetail 运行时反馈检查报告

日期：2026-09-24

## 范围

- `ui/src/pages/apps/AppDetail.tsx`
- `ui/src/i18n/locales/en.json`、`zh-CN.json`，以及由英文基准生成的其余语言包

本切片将详情页的重连授权状态、保存/重命名/登录/刷新失败提示、受众反馈、操作发现计数、GitHub 访问反馈、撤销/暂停/关注/连接状态和回退文案接入 i18n。

运行时返回的帐户名、连接健康信息和服务端错误保持原值。

## 验证

| 检查 | 结果 |
| --- | --- |
| locale 生成与键集校验 | 40 个语言包一致，共 4,134 键 |
| `AppDetail.test.tsx` | 59/59 通过 |
| AppDetail AST 复扫 | 0 个可见英文候选 |
| Token Gate / `git diff --check` | 通过 |
| UI typecheck | 仅既有 `InstanceExperimentalSettings.test.tsx:71` 缺少 `enableMcpAggregators`；本切片未新增诊断 |

## 提交

- `6dcc88a72` `Localize app detail runtime feedback`

## 后续

继续接线共享连接身份辅助函数及详情页子面板，再对 Apps 顶层目录复扫。
