// 第 10 批截图：议题列表页收尾（IssueFiltersPopover / IssueRow / IssuesList）。
// 英/中默认态对照 + 筛选/排序/分组弹层中文 + 失败路径回退 + 语言持久化。
// 用法：node screenshot-batch10-issueslist.mjs <输出目录>
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const outDir = process.argv[2];
await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/google-chrome" });
const problems = [];
const COMPANY_ID = "709b6d8c-3700-4d12-81af-c414a61e8aca";
const BASE = "http://127.0.0.1:3200";

async function openPage(lng, viewport, query = "") {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const tag = `${lng ?? "none"}-${viewport.width}`;
  page.on("console", (m) => { if (m.type() === "error") problems.push(`${tag} console: ${m.text()}`); });
  page.on("pageerror", (e) => problems.push(`${tag} pageerror: ${e.message}`));
  page.on("response", (r) => { if (r.status() >= 400) problems.push(`${tag} http ${r.status()} ${r.url()}`); });
  const lngParam = lng === "zh" ? "lng=zh-CN" : lng === "en" ? "lng=en" : "";
  const sep = lngParam ? "&" : "?";
  await page.goto(`${BASE}/ANC/issues${lngParam ? `?${lngParam}` : ""}${query ? `${sep}${query}` : ""}`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1000);
  return { ctx, page };
}

async function shot(page, name) {
  const lang = await page.evaluate(() => document.documentElement.lang);
  console.log(name, "lang=", lang);
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
}

// ==== Part 1: issues list default entry, en + zh (list rows, parent/child nesting, blocked chip) ====
for (const lng of ["en", "zh"]) {
  const { ctx, page } = await openPage(lng, { width: 1440, height: 900 });
  const text = await page.evaluate(() => document.body.innerText);
  console.log(`${lng} issues list contains fixture titles:`, text.includes("批10验证"));
  await shot(page, `${lng}-desktop-issueslist`);
  await ctx.close();
}

// ==== Part 2: zh — Filters popover, Sort popover, Group popover ====
{
  const { ctx, page } = await openPage("zh", { width: 1440, height: 900 });
  // Filters popover
  await page.getByTitle("筛选").first().click().catch(async () => {
    await page.locator('button[title*="筛选"]').first().click();
  });
  await page.waitForTimeout(400);
  await shot(page, "zh-filters-popover");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // Sort popover
  await page.locator('button[title="排序"]').first().click();
  await page.waitForTimeout(400);
  await shot(page, "zh-sort-popover");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // Group popover
  await page.locator('button[title="分组"]').first().click();
  await page.waitForTimeout(400);
  await shot(page, "zh-group-popover");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // Group by status to show translated group headers, then screenshot the grouped list.
  await page.locator('button[title="分组"]').first().click();
  await page.waitForTimeout(300);
  await page.getByText("状态", { exact: true }).first().click();
  await page.waitForTimeout(500);
  const groupedText = await page.evaluate(() => document.body.innerText);
  console.log("zh grouped-by-status contains 进行中/待办/已阻塞:",
    groupedText.includes("进行中") && groupedText.includes("待办") && groupedText.includes("已阻塞"));
  await shot(page, "zh-grouped-by-status");
  await ctx.close();
}

// ==== Part 3: en — Filters popover, Sort popover, Group popover (English control) ====
{
  const { ctx, page } = await openPage("en", { width: 1440, height: 900 });
  await page.locator('button[title="Filter"]').first().click();
  await page.waitForTimeout(400);
  await shot(page, "en-filters-popover");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.locator('button[title="Sort"]').first().click();
  await page.waitForTimeout(400);
  await shot(page, "en-sort-popover");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.locator('button[title="Group"]').first().click();
  await page.waitForTimeout(400);
  await shot(page, "en-group-popover");
  await ctx.close();
}

// ==== Part 4: failure paths (先验) ====
{
  const { ctx, page } = await openPage(null, { width: 1440, height: 900 }, "lng=unknown-locale");
  const lang = await page.evaluate(() => document.documentElement.lang);
  console.log("fail-01 unknown-locale lang=", lang);
  if (lang !== "en") problems.push(`fail-01: expected fallback to en, got ${lang}`);
  await shot(page, "fail-01-unknown-locale-fallback-en");
  await ctx.close();
}
{
  const { ctx, page } = await openPage(null, { width: 1440, height: 900 }, "lng=zh-cn");
  const lang = await page.evaluate(() => document.documentElement.lang);
  console.log("fail-02 casing zh-cn lang=", lang);
  if (lang !== "en") problems.push(`fail-02: expected fallback to en, got ${lang}`);
  await shot(page, "fail-02-casing-zh-cn-fallback-en");
  await ctx.close();
}

// ==== Part 5: language switcher persistence across reload ====
{
  const { ctx, page } = await openPage(null, { width: 1440, height: 900 });
  await page.evaluate(() => window.localStorage.setItem("paperclip.locale", "zh-CN"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const lang = await page.evaluate(() => document.documentElement.lang);
  console.log("persisted-locale lang after reload=", lang);
  if (lang !== "zh-CN") problems.push(`persist: expected zh-CN after reload, got ${lang}`);
  await shot(page, "persist-zh-CN-after-reload");
  await ctx.close();
}

console.log("problems:", problems.length ? problems : "none");
await browser.close();
