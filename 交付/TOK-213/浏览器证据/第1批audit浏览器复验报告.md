# TOK-213 第 1 批 audit 试点浏览器复验报告

## 结论

隔离实例 `http://127.0.0.1:3200` 的 audit 路由（`/TOK/activity?mode=agents`）已实测：默认英文，用户可从账户菜单的语言选择器切到简体中文；切换立即生效，刷新后仍保持 `zh-CN`。在桌面 `1366×768` 与移动 `390×844` 两个断点，页面正文没有横向溢出、按钮未撑破、没有文字重叠或异常换行。

本报告仅证明 audit 试点的语言入口、持久化及排版；不构成全站或整机放行。

## 环境与操作

- 分支／提交：`feat/anc-zh-cn`／`19782edb4`
- 隔离服务：`127.0.0.1:3200`（独立数据库端口 `54339`）；未访问正式实例 `3100/54329`。
- 浏览器：本机 Chromium（Playwright 驱动）。
- 操作：打开 audit 路由 → 账户菜单的 `Language` 下拉框（`English`／`简体中文`）→ 选择 `zh-CN` → 读取 `html[lang]` 和 `localStorage.paperclip.locale` → 刷新页面。

## 证据索引

| 文件 | 断点／状态 | 观察与自动断言 | SHA-256 |
| --- | --- | --- | --- |
| `audit-zh-cn-桌面.png` | 桌面，英文默认 | 默认页仍为英文；文件名保留采集时命名，内容不是中文页。 | `0034b3f3d41ab774edd316a1eb7ff120ee3afa815ef7bbfe5aa16f05e0b3a9d5` |
| `audit-语言入口-桌面.png` | 桌面，入口展开 | 账户菜单显示 `Language` 选择器及 `English`／`简体中文` 两个选项。 | `8ef18f4a0e199be3095f02f84bc5994e1ad2551e098494b385a61646e8248c7b` |
| `audit-zh-CN-切换后-桌面.png` | 桌面，切换后 | `html[lang]=zh-CN`、`localStorage.paperclip.locale=zh-CN`；`scrollWidth=1366`、`innerWidth=1366`。 | `855d08198a44a0cae963cb7103358330f816c4d0d99b69ed0826d94900845eb1` |
| `audit-zh-CN-刷新后-桌面.png` | 桌面，刷新后 | 刷新后仍为中文，`html[lang]` 与持久化值仍为 `zh-CN`；无横向溢出。 | `ae93d624da825c2ae469f8c4b5c0b51bf0e1a925285c4d98c27b80aa3e3879ec` |
| `audit-zh-CN-浏览器中文区域-桌面.png` | 桌面，浏览器区域为 `zh-CN` | 用于复核原生日期控件的显示；页面语言和布局与切换后桌面图一致。 | `855d08198a44a0cae963cb7103358330f816c4d0d99b69ed0826d94900845eb1` |
| `audit-zh-CN-切换后-移动.png` | 移动，切换后 | `html[lang]=zh-CN`、持久化值为 `zh-CN`；`scrollWidth=390`、`innerWidth=390`，审计正文已中文化。 | `845dfd48ec8f0a6a9ddc7eb222b31a501ff163e2f272ac2bdda19165bb890f19` |

## 排版与异常记录

- 桌面和移动截图均未见正文截断、控件重叠、按钮撑破或错误换行；横向尺寸断言也为通过。
- Chromium 的空 `input[type=date]` 原生外观在中文页面仍绘制为 `mm/dd/yyyy`。页面本身的 `aria-label` 是“起始日期”／“结束日期”，且没有页面文本形式的 `mm/dd/yyyy`。这是浏览器原生控件显示行为；本轮不将“日期格式中文化”判为已验证，保留为**未核实**，须在支持该原生控件本地化的目标浏览器上复验。
- 网络与控制台仅有一次种子公司徽标资源 `GET /api/assets/2b9bc29c-97ce-4ba6-b2eb-8619cc453517/content` 返回 404；这是隔离 seed 数据缺少徽标，不是 i18n 请求、路由或脚本错误。未见其他 4xx/5xx。
