// 批次 2 验证：只用 UI 操作（全程不带 ?lng=）切换语言，并验证刷新后保持。
// 用法：node screenshot-language-switch.mjs <截图输出目录>
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

const outDir = process.argv[2];
await fs.mkdir(outDir, { recursive: true });
const BASE = "http://127.0.0.1:3200/ANC";

const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/google-chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const problems = [];
page.on("console", (msg) => { if (msg.type() === "error") problems.push(`[console:error] ${msg.text()}`); });
page.on("pageerror", (err) => problems.push(`[pageerror] ${err.message}`));
page.on("response", (res) => { if (res.status() >= 400) problems.push(`[http] ${res.status()} ${res.url()}`); });

const state = async () => ({
  url: page.url(),
  htmlLang: await page.evaluate(() => document.documentElement.lang),
  stored: await page.evaluate(() => localStorage.getItem("paperclip.locale")),
});
const shot = (name) => page.screenshot({ path: path.join(outDir, name) });
const log = (label, s) => console.log(label, JSON.stringify(s));

async function openMenu() {
  await page.getByRole("button", { name: "Open account menu" }).click();
  await page.locator("select[aria-label]").first().waitFor();
}

// 1) 默认：英文，未存任何偏好
await page.goto(`${BASE}/search`, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(1000);
let s = await state(); log("1 default", s);
assert.equal(s.htmlLang, "en"); assert.equal(s.stored, null); assert.ok(!s.url.includes("lng="));
assert.ok(await page.getByText("Tasks", { exact: true }).count() > 0, "英文搜索范围标签应为 Tasks");
await shot("b2-01-search-en-default.png");

// 2) 打开账号菜单，切换器可见
await openMenu();
await page.waitForTimeout(300);
await shot("b2-02-account-menu-language-switcher.png");
const options = await page.locator("select[aria-label]").first().locator("option").allTextContents();
console.log("options", JSON.stringify(options));
assert.deepEqual(options, ["English", "简体中文"]);

// 3) 用 UI 选简体中文——不刷新，页面立即变中文
await page.locator("select[aria-label]").first().selectOption("zh-CN");
await page.waitForTimeout(800);
s = await state(); log("3 after switch", s);
assert.equal(s.htmlLang, "zh-CN"); assert.equal(s.stored, "zh-CN"); assert.ok(!s.url.includes("lng="));
assert.ok(await page.getByText("任务", { exact: true }).count() > 0, "切换后应立即变中文（任务）");
await shot("b2-03-search-zh-after-switch-no-reload.png");

// 4) 刷新（URL 不带 lng）：仍是中文
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1000);
s = await state(); log("4 after reload", s);
assert.equal(s.htmlLang, "zh-CN"); assert.equal(s.stored, "zh-CN"); assert.ok(!s.url.includes("lng="));
assert.ok(await page.getByText("任务", { exact: true }).count() > 0, "刷新后应仍是中文");
await shot("b2-04-search-zh-after-reload.png");

// 4b) 关掉再重新打开（新页面、同一浏览器上下文）：仍是中文
const page2 = await ctx.newPage();
await page2.goto(`${BASE}/search`, { waitUntil: "networkidle", timeout: 30000 });
await page2.waitForTimeout(800);
assert.equal(await page2.evaluate(() => document.documentElement.lang), "zh-CN");
await page2.close();

// 5) 切回英文，刷新：仍是英文
await openMenu();
await page.waitForTimeout(300);
await shot("b2-05-account-menu-zh-open.png");
await page.locator("select[aria-label]").first().selectOption("en");
await page.waitForTimeout(800);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1000);
s = await state(); log("5 back to en + reload", s);
assert.equal(s.htmlLang, "en"); assert.equal(s.stored, "en"); assert.ok(!s.url.includes("lng="));
assert.ok(await page.getByText("Tasks", { exact: true }).count() > 0);
await shot("b2-06-search-en-after-reload.png");

console.log("problems:", problems.length ? problems : "none");
await browser.close();
