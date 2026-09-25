# 为 Web 界面增加一种语言

Web 文案的键集以 `ui/src/i18n/locales/en.json` 为准。`zh-CN.json` 是简体中文译文；其余已有语言包当前主要是英文占位，不表示这些语言已经译完。界面默认语言仍为 `en`。

1. 选定语言码，例如 `fr`，在 `ui/src/i18n/locales/` 新建同名 `fr.json`。先从 `en.json` 复制完整结构，再逐条翻译值；不要改键名、变量占位符（如 `{{name}}`）、产品名、API 路径或配置枚举。译文须满足 `ui/src/i18n/locale-validation.ts` 的长度和内容约束。
2. `ui/src/i18n/locales.ts` 用 `import.meta.glob` 自动读取该目录的 JSON 文件，无须手工登记资源。文件加入后会进入 `supportedLocales`，但尚不会出现在语言切换器中。
3. 只有译文完成并经过界面检查后，才在 `ui/src/i18n/index.ts` 的 `selectableLocales` 中增加 `{ code: "fr", label: "Français" }`。`ui/src/context/LocaleContext.tsx` 用这份列表展示可选语言并保存选择。勿把仅有英文占位的语言包加入列表。
4. 英文基准增加新键后，在仓库根目录运行 `node scripts/generate-i18n-locales.mjs`，为其余非英文、非简中语言包补齐键形；再为已上线的译文填写新键。普通模式保留已有译值。`--copy-en-values` 会将这些语言包的所有值重置为英文，**已翻译的语言包不要使用该选项**。脚本不处理 `zh-CN.json`，简中新增键须单独维护。
5. 在仓库根目录运行 `node scripts/check-i18n-locales.mjs`、`pnpm --dir ui exec vitest run src/i18n/locale-validation.test.ts src/context/LocaleContext.test.tsx` 和 `pnpm --dir ui typecheck`。检查新语言下的页面、插值、布局、切换及刷新后的持久化；同时确认无参数打开时仍为英文，未知语言码回退英文。键集通过只证明结构一致，不证明译文或页面显示正确。

推理强度档位名（如 `Auto`、`Low`、`Medium`、`High`）保持英文，不做翻译。新增语言后还须按实际界面逐项核对这些名称。
