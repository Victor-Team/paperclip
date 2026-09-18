// 批次 2 补充：Auth 页（icon 形态）与设计指南页（三种形态）的排版截图。
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
const outDir = process.argv[2];
await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/google-chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const problems = [];
page.on("pageerror", (err) => problems.push(`[pageerror] ${err.message}`));
for (const [name, url] of [["auth", "http://127.0.0.1:3200/auth"], ["design-guide", "http://127.0.0.1:3200/ANC/design-guide"]]) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(800);
  console.log(name, "->", page.url(), "selects:", await page.locator("select[aria-label]").count());
  if (await page.locator("select[aria-label]").count()) await page.locator("select[aria-label]").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(outDir, `b2-variants-${name}-en.png`) });
  if (await page.locator("select[aria-label]").count()) {
    await page.locator("select[aria-label]").first().selectOption("zh-CN");
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(outDir, `b2-variants-${name}-zh.png`) });
    await page.locator("select[aria-label]").first().selectOption("en");
    await page.waitForTimeout(300);
  }
}
console.log("problems:", problems.length ? problems : "none");
await browser.close();
