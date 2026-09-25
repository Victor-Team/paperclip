// 第 4 批 Issues.tsx 截图：默认英文 + ?lng=zh-CN，桌面 1440×900 与移动 390×844 两套断点。
// 另断言：面包屑 "Tasks"/"任务"，以及不带 ?lng= 时 <html lang="en">。
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const outDir = process.argv[2];
await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/google-chrome" });
const problems = [];
const shots = [
  ["01-issues-en-desktop", "", { width: 1440, height: 900 }],
  ["02-issues-zh-desktop", "?lng=zh-CN", { width: 1440, height: 900 }],
  ["03-issues-en-mobile", "", { width: 390, height: 844 }],
  ["04-issues-zh-mobile", "?lng=zh-CN", { width: 390, height: 844 }],
];
for (const [name, query, viewport] of shots) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") problems.push(`${name} console: ${m.text()}`); });
  page.on("pageerror", (e) => problems.push(`${name} pageerror: ${e.message}`));
  page.on("response", (r) => { if (r.status() >= 400) problems.push(`${name} http ${r.status()} ${r.url()}`); });
  await page.goto(`http://127.0.0.1:3200/ANC/issues${query}`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);
  if (await page.getByText(/Create your first agent|创建您的第一个智能体/).count()) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(800);
  }
  const lang = await page.evaluate(() => document.documentElement.lang);
  const crumb = await page.evaluate(() => document.querySelector("nav[aria-label='breadcrumb'], [data-slot='breadcrumb']")?.textContent ?? document.title);
  console.log(name, "lang=", lang, "crumb=", JSON.stringify(crumb));
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
  await ctx.close();
}
await browser.close();
console.log("problems:", problems.length ? problems : "none");
