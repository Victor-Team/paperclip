# TOK-213 第39批 Slack 头像、身份和工具设置中文接线阶段检查

- 执行席：开发部·前端实现席；日期：2026-09-25；代码提交：`43818d667acf7ab30bedf3563b6a840051ff9f49`。
- 范围：`ui/src/pages/apps/chat/SlackAvatarStep.tsx`、`SlackIdentityStep.tsx`、`SlackToolSettings.tsx` 与 `SlackAvatarStep.test.tsx`；英／简中事实来源语言包和由现有脚本生成的其余 38 个 locale。该子目录仅 13 个生产 TSX，三件组件分别承担头像、账号关联、工具及搜索设置；本批按同一 Slack 流程内聚处理，未凑 30 个文件。未改并行席组件或共享脚本。
- 接线：原三文件 AST 可见英文候选合计 85，按完整句子重组后新增 78 个 `module.section.key` 双语键；复扫三文件 AST 候选 0。40 个 locale 各 11,326 键，键集一致；78 个英／简中值的插值参数一致。语言默认仍为英文，产品名、OAuth 权限范围、命令与文件名保持原值。
- 覆盖：头像图片替代文字、下载失败、上传步骤和确认态；账号身份识别、复制、关联状态、校验失败和无障碍标签；Slack 工具能力、权限、搜索连接和 OAuth 设置。语言切换测试验证头像说明与搜索状态从英语切至简中，并保持应用名和 scope 原值。

## 验证

| 检查 | 结果 |
|---|---|
| `pnpm exec vitest run ui/src/pages/apps/chat/SlackAvatarStep.test.tsx ui/src/i18n` | 12/12 通过 |
| `pnpm exec vitest run ui/src/pages/apps/chat/ChatEndpoint.clipboard.test.tsx` | 28/28 通过 |
| `pnpm --filter @paperclipai/ui exec tsc -b --pretty false` | 通过 |
| `node scripts/check-i18n-locales.mjs` | 40 个 locale 各 11,326 键且与 `en.json` 一致 |
| 78 个英／简中插值参数逐键比较 | 一致 |
| `pnpm check:token-gates` | 四项 CLEAN |
| `git diff --check` | 通过 |
| 三文件 codemod AST 复扫 | 可见英文候选 0 |
| 浏览器组件预览 | 桌面 1366×768、窄屏 390×844 中文和桌面英文；页面异常 0、HTTP 错误 0、横向溢出 0；索引：`交付/TOK-213/浏览器证据/第39批/证据索引.md` |

## 尚未完成

- 浏览器证据是隔离组件预览，未连接真实 Slack 端点；身份候选、失败态、OAuth 配置展开和搜索已连接态缺实际路由双断点截图。设计稿未核实，独立席位未复核，不能作为子目录或全站放行。
- `SlackToolSettings.tsx` 的工具名来自服务端 `tool.name` 代码标识（当前仅替换下划线供人阅读），`error`、`status.limitation`、账号外部标签等服务端自由文本仍保留原值；需要后续按真实数据决定显示名和服务端文本的翻译边界。
- 外部 Slack 后台字段 `Basic Information`、`Display Information`、`App icon & Preview`、`Save Changes`、`OAuth & Permissions` 和 scope `search:read.*` 保留官方标识，便于照步骤定位。产品名 Slack、Paperclip、Cliptoon 保留原文。
- 共享 `ui/src/components/SetupWizard.tsx:92-97` 的 `Save & exit` 仍英文；本席未修改并行席目录，已在本单指名交给后端实现席处理。
- 默认隔离入口 `pnpm paperclipai run` 的 doctor 缺 `cli/install.json` 问题沿用第35批结论，本批仅用隔离 Vite 3200 组件预览，未触碰正式实例。仓库全量类型检查、测试和构建未跑；本批代码仅涉及上述 UI 文件，已运行定向门禁。

第39批只是阶段产物。继续在 TOK-213 原单处理 `pages/apps/chat/**` 余项，最终需真实双断点整机证据和独立席复核。
