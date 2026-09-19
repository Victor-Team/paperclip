// 第 5 批 侧栏截图：默认英文 + ?lng=zh-CN，桌面 1440×900，整页截图。用法：node screenshot-sidebar.mjs <输出目录> [base|flags|prod]
// 断言：不带 ?lng= 时 <html lang="en">；输出 <aside> 内可见文字，供核对哪些串仍是英文。
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const outDir = process.argv[2];
await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/google-chrome" });
const problems = [];
// 分组：base=默认设置；flags=streamlined 布局＋实验开关全开；prod=关闭 streamlined（走 Sidebar.production 孪生）＋开关全开
const group = process.argv[3] ?? "base";
const prefix = { base: ["01", "02"], flags: ["05", "06"], prod: ["07", "08"] }[group];
const label = { base: "sidebar", flags: "sidebar-flags", prod: "sidebar-production" }[group];
const shots = [
  [`${prefix[0]}-${label}-en-desktop`, "dashboard", ""],
  [`${prefix[1]}-${label}-zh-desktop`, "dashboard", "?lng=zh-CN"],
];
for (const [name, route, query] of shots) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") problems.push(`${name} console: ${m.text()}`); });
  page.on("pageerror", (e) => problems.push(`${name} pageerror: ${e.message}`));
  page.on("response", (r) => { if (r.status() >= 400) problems.push(`${name} http ${r.status()} ${r.url()}`); });
  await page.goto(`http://127.0.0.1:3200/ANC/${route}${query}`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);
  if (await page.getByText(/Create your first agent|创建您的第一个智能体/).count()) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(800);
  }
  const lang = await page.evaluate(() => document.documentElement.lang);
  const aside = await page.evaluate(() => [...document.querySelectorAll("aside")].map((a) => a.innerText.replace(/\n+/g, " | ")));
  console.log(name, "lang=", lang, "aside=", JSON.stringify(aside));
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
  await ctx.close();
}
await browser.close();
console.log("problems:", problems.length ? problems : "none");
