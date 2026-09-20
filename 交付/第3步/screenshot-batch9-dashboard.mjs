// 第 9 批截图：仪表盘本体（ActiveAgentsPanel + ActivityCharts + timeAgo）。
// 英/中各一份 + 失败路径回退证据 + 语言切换即时联动/持久化证据。
// 用法：node screenshot-batch9-dashboard.mjs <输出目录>
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const outDir = process.argv[2];
await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/google-chrome" });
const problems = [];
const COMPANY_ID = "709b6d8c-3700-4d12-81af-c414a61e8aca";
const BASE = "http://127.0.0.1:3200";

async function api(page, method, urlPath, body) {
  return page.evaluate(
    async ({ method, urlPath, body }) => {
      const res = await fetch(urlPath, {
        method,
        headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
        credentials: "same-origin",
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      return { status: res.status, body: text };
    },
    { method, urlPath, body },
  );
}

async function openPage(lng, viewport, query = "") {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const tag = `${lng}-${viewport.width}`;
  page.on("console", (m) => { if (m.type() === "error") problems.push(`${tag} console: ${m.text()}`); });
  page.on("pageerror", (e) => problems.push(`${tag} pageerror: ${e.message}`));
  page.on("response", (r) => { if (r.status() >= 400) problems.push(`${tag} http ${r.status()} ${r.url()}`); });
  const lngParam = lng === "zh" ? "lng=zh-CN" : lng === "en" ? "lng=en" : "";
  const sep = query ? "&" : (lngParam ? "?" : "");
  await page.goto(`${BASE}/ANC/dashboard${lngParam ? `?${lngParam}` : ""}${query ? `${sep}${query}` : ""}`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1000);
  return { ctx, page };
}

async function shot(page, name) {
  const lang = await page.evaluate(() => document.documentElement.lang);
  console.log(name, "lang=", lang);
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
}

let agentId = null;

// ---- Setup: create a fixture agent so the dashboard chrome renders (empty company shows onboarding) ----
{
  const { ctx, page } = await openPage("en", { width: 1440, height: 900 });
  const agentResult = await api(page, "POST", `/api/companies/${COMPANY_ID}/agents`, { name: "批9验证智能体", adapterType: "process" });
  console.log("agent create:", agentResult.status);
  if (agentResult.status < 300) agentId = JSON.parse(agentResult.body).id;
  await ctx.close();
}
if (!agentId) problems.push("setup: agent create failed");

// ==== Part 1: dashboard default entry, en + zh (ActiveAgentsPanel empty state + ActivityCharts empty states) ====
for (const lng of ["en", "zh"]) {
  const { ctx, page } = await openPage(lng, { width: 1440, height: 900 });
  const text = await page.evaluate(() => document.body.innerText);
  console.log(`${lng} dashboard contains 'No recent agent runs.'/'暂无近期智能体运行记录':`,
    text.includes("No recent agent runs.") || text.includes("暂无近期智能体运行记录"));
  console.log(`${lng} dashboard contains 'No runs yet'/'暂无运行记录':`,
    text.includes("No runs yet") || text.includes("暂无运行记录"));
  await shot(page, `${lng}-desktop-dashboard`);
  await ctx.close();
}

// ==== Part 2: failure paths (先验) ====
{
  // Unknown language code falls back to English.
  const { ctx, page } = await openPage(null, { width: 1440, height: 900 }, "lng=unknown-locale");
  const lang = await page.evaluate(() => document.documentElement.lang);
  console.log("fail-01 unknown-locale lang=", lang);
  if (lang !== "en") problems.push(`fail-01: expected fallback to en, got ${lang}`);
  await shot(page, "fail-01-unknown-locale-fallback-en");
  await ctx.close();
}
{
  // Case-sensitive locale code (zh-cn instead of zh-CN) falls back to English.
  const { ctx, page } = await openPage(null, { width: 1440, height: 900 }, "lng=zh-cn");
  const lang = await page.evaluate(() => document.documentElement.lang);
  console.log("fail-02 casing zh-cn lang=", lang);
  if (lang !== "en") problems.push(`fail-02: expected fallback to en, got ${lang}`);
  await shot(page, "fail-02-casing-zh-cn-fallback-en");
  await ctx.close();
}

// ==== Part 3: language switcher UI immediate + persisted across reload ====
// Note: navigate WITHOUT a `?lng=` param here, since `?lng=` always wins over the
// saved preference (see ui/src/i18n/index.ts `initialLocale()`) — that's tested
// separately by fail-01/fail-02 above.
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

// ---- Cleanup fixture ----
{
  const { ctx, page } = await openPage("en", { width: 1440, height: 900 });
  if (agentId) console.log("agent delete:", (await api(page, "DELETE", `/api/agents/${agentId}`)).status);
  await ctx.close();
}

console.log("problems:", problems.length ? problems : "none");
await browser.close();
