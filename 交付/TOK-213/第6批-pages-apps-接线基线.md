# TOK-213 第 6 批 `pages/apps` 接线基线

## 扫描范围

- 分支基线：`feat/anc-zh-cn` 于 `30c573add`。
- 命令：`node scripts/i18n-codemod.mjs --directory ui/src/pages/apps --json <run-scratch>/pages-apps-scan.json`。
- 范围：`ui/src/pages/apps` 下 37 个非测试 TSX，符合本线每批 30–60 文件的约束。

## 结果

| 指标 | 值 |
| --- | ---: |
| 扫描文件 | 37 |
| 检出的可见英文串 | 748 |
| AST 自动可接线 | 748 |
| 需人工语法兜底 | 0 |
| 自动接线率 | 100% |

已有 14 个文件本轮扫描为 0 候选，说明此前 `pages/apps` 的已交付切片仍被识别为已接入，未被重复纳入待改范围。

## 待接线文件与候选数

`AppDetail` 15、`Browse` 31、`Connections` 50、`IdentitiesSection` 30、`PermissionsPanel` 13、`RailwayAccessPanel` 1、`ChatEndpointDetail` 82、`ChatEndpointSetup` 227、`ChatIdentityConfirm` 17、`EmailEndpointSetup` 69、`PhotonConnectStep` 23、`connection-owner` 1、`ConnectClientDialog` 23、`CopyableGatewayUrl` 1、`EditGatewayDialog` 9、`GatewayDetail` 7、`GatewaysList` 23、`NewGatewayDialog` 14、`AppsToolsPanel` 8、`GatewayActivityPanel` 16、`GatewayAdvancedPanel` 15、`OverviewPanel` 27、`TokensPanel` 46。

本基线只记录 AST 可见文案范围；动态应用名、人员名、路径、服务端错误和代码标识仍按既定边界保持原值。下一实施步将用这同一份范围执行接线、中文译文与 40 locale 键集同步，再以同一扫描器复扫为 0。
