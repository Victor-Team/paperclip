# TOK-213 第45批：邮件与 Telegram 完整译句检查报告

日期：2026-09-25。执行席：开发部·前端实现席。代码提交：`bd8fa84c3e98402f12e3e0fb31e9532ac75249c9`。本批仅处理 `ui/src/pages/apps/chat/**` 内聚范围；该目录的生产 TSX 不足 30 个，未为凑文件数扩大到别席目录。

## 范围与改动

- `EmailEndpointSetup.tsx`：分配对象与接收模式、收信对象、智能体信任设置标题、上次邮件检查值改为完整插值译句。检查时间调用 `toLocaleString(i18n.language)`，随当前界面语言格式化。智能体名称、模式和时间仍是数据值，不翻译用户数据。
- `ChatEndpointSetup.tsx`：Telegram 建连的 BotFather 指令、用户名要求、群组命令说明改为完整 `<Trans>` 译句。`/newbot`、`bot` 和 `/task@bot_username <request>` 是可执行代码或占位符，英／简中均保持原文。`<request>` 经固定值插值后由 React 正确转义为可见尖括号。
- 英文和简中事实源替换 8 个碎片键为 7 个完整句键；其余 38 个语言包由生成脚本同步键形，并对新群组说明键同步英文占位值。40 个 locale 各 11,339 键；默认语言仍为英文，其他 38 个语种仍是英文占位。

## 验证

- `pnpm --dir ui exec vitest run src/pages/apps/chat`：14 个文件、116/116 通过。新增 Telegram 渲染测试在英／简中下检查 `<code>` 内三个控制项；首次测试发现 `&lt;request&gt;` 被二次转义，改为插值后复跑通过。
- `pnpm --dir ui exec tsc -b --pretty false`、`node scripts/check-i18n-locales.mjs`、`pnpm check:token-gates`、`git diff --check` 均通过。Token Gate 四项 CLEAN；新增英／简中键的插值参数和标签一致。

## 浏览器证据与未决项

本批没有真实邮件收件箱或 Telegram 已建连接的动态态浏览器截图，也未创建用于抵达向导后续步骤的数据。组件测试证明译文解析及命令保留，不证明真实路由布局或切换刷新持久化。桌面 1366×768、窄屏 390×844 动态态，设计稿对照和独立席复核均待补；本批不作为聊天目录或全站放行。
