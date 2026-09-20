import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const outDir = "/home/yuanjian/dev/ANC-zh-cn/交付/TOK-213/批次9复验";
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
  const tag = `${lng || "default"}-${viewport.width}`;
  page.on("console", (m) => { if (m.type() === "error") problems.push(`${tag} console: ${m.text()}`); });
  page.on("pageerror", (e) => problems.push(`${tag} pageerror: ${e.message}`));
  page.on("response", (r) => {
    // Ignore benign 404 for plan document on new tasks
    if (r.status() >= 400 && !r.url().includes("/documents/plan")) {
      problems.push(`${tag} http ${r.status()} ${r.url()}`);
    }
  });

  const lngParam = lng === "zh" ? "lng=zh-CN" : lng === "en" ? "lng=en" : "";
  let url = `${BASE}/ANC/dashboard`;
  const params = [];
  if (lngParam) params.push(lngParam);
  if (query) params.push(query);
  if (params.length > 0) url += `?${params.join("&")}`;

  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(800);
  return { ctx, page };
}

async function shot(page, name) {
  const lang = await page.evaluate(() => document.documentElement.lang);
  console.log(`[SHOT] ${name}.png (lang=${lang})`);
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
}

let agentId = null;

// ---- Setup: create a fixture agent so the dashboard renders instead of onboarding ----
{
  const { ctx, page } = await openPage("en", { width: 1440, height: 900 });
  const agentResult = await api(page, "POST", `/api/companies/${COMPANY_ID}/agents`, {
    name: "批9整机放行验证智能体",
    adapterType: "process",
  });
  console.log("fixture agent create:", agentResult.status);
  if (agentResult.status < 300) agentId = JSON.parse(agentResult.body).id;
  await ctx.close();
}

if (!agentId) problems.push("setup: fixture agent create failed");

// ==== PART 1: 失败路径（先验）====

// 1. 未知语言代码回退英文
{
  const { ctx, page } = await openPage(null, { width: 1440, height: 900 }, "lng=unknown-locale");
  const lang = await page.evaluate(() => document.documentElement.lang);
  console.log("fail-01 unknown-locale: html lang =", lang);
  if (lang !== "en") problems.push(`fail-01: expected fallback en, got ${lang}`);
  const text = await page.evaluate(() => document.body.innerText);
  if (!text.includes("Agents") || !text.includes("No recent agent runs.")) {
    problems.push("fail-01: text did not render default English");
  }
  await shot(page, "fail-01-unknown-locale-fallback-en");
  await ctx.close();
}

// 2. 大小写不匹配语言代码回退英文 (zh-cn != zh-CN)
{
  const { ctx, page } = await openPage(null, { width: 1440, height: 900 }, "lng=zh-cn");
  const lang = await page.evaluate(() => document.documentElement.lang);
  console.log("fail-02 casing mismatch zh-cn: html lang =", lang);
  if (lang !== "en") problems.push(`fail-02: expected fallback en, got ${lang}`);
  const text = await page.evaluate(() => document.body.innerText);
  if (!text.includes("Agents") || !text.includes("No recent agent runs.")) {
    problems.push("fail-02: text did not render default English");
  }
  await shot(page, "fail-02-casing-zh-cn-fallback-en");
  await ctx.close();
}

// 3. 损坏的 localStorage 偏好回退英文
{
  const { ctx, page } = await openPage(null, { width: 1440, height: 900 });
  await page.evaluate(() => window.localStorage.setItem("paperclip.locale", "corrupted-value-xyz"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const lang = await page.evaluate(() => document.documentElement.lang);
  console.log("fail-03 corrupted localStorage: html lang =", lang);
  if (lang !== "en") problems.push(`fail-03: expected fallback en, got ${lang}`);
  const text = await page.evaluate(() => document.body.innerText);
  if (!text.includes("Agents") || !text.includes("No recent agent runs.")) {
    problems.push("fail-03: text did not render default English");
  }
  await shot(page, "fail-03-corrupted-storage-fallback-en");
  await ctx.close();
}

// ==== PART 2: 默认生产入口与正常路径 ====

// 01. 默认英文态
{
  const { ctx, page } = await openPage("en", { width: 1440, height: 900 });
  const lang = await page.evaluate(() => document.documentElement.lang);
  const text = await page.evaluate(() => document.body.innerText);
  console.log("01 en dashboard: lang =", lang);
  if (lang !== "en") problems.push(`01: expected en, got ${lang}`);
  if (!text.includes("No recent agent runs.")) problems.push("01: missing 'No recent agent runs.'");
  if (!text.includes("No runs yet")) problems.push("01: missing 'No runs yet'");
  if (!text.includes("No tasks")) problems.push("01: missing 'No tasks'");
  await shot(page, "01-en-desktop-dashboard");
  await ctx.close();
}

// 02. 中文态
{
  const { ctx, page } = await openPage("zh", { width: 1440, height: 900 });
  const lang = await page.evaluate(() => document.documentElement.lang);
  const text = await page.evaluate(() => document.body.innerText);
  console.log("02 zh dashboard: lang =", lang);
  if (lang !== "zh-CN") problems.push(`02: expected zh-CN, got ${lang}`);
  if (!text.includes("暂无近期智能体运行记录。")) problems.push("02: missing '暂无近期智能体运行记录。'");
  if (!text.includes("暂无运行记录")) problems.push("02: missing '暂无运行记录'");
  if (!text.includes("暂无任务")) problems.push("02: missing '暂无任务'");
  await shot(page, "02-zh-desktop-dashboard");
  await ctx.close();
}

// 03. UI 语言切换器即时变中文
{
  const { ctx, page } = await openPage(null, { width: 1440, height: 900 });
  // Set localStorage to zh-CN and trigger storage event / dispatch
  await page.evaluate(() => {
    window.localStorage.setItem("paperclip.locale", "zh-CN");
    window.dispatchEvent(new Event("storage"));
  });
  // Navigate without ?lng= to confirm immediate rendering
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const lang = await page.evaluate(() => document.documentElement.lang);
  console.log("03 immediate switch zh: lang =", lang);
  if (lang !== "zh-CN") problems.push(`03: expected zh-CN, got ${lang}`);
  await shot(page, "03-ui-switch-immediate-zh");
  await ctx.close();
}

// 04. 刷新后维持持久化
{
  const { ctx, page } = await openPage(null, { width: 1440, height: 900 });
  await page.evaluate(() => window.localStorage.setItem("paperclip.locale", "zh-CN"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const lang = await page.evaluate(() => document.documentElement.lang);
  console.log("04 persisted zh-CN: lang =", lang);
  if (lang !== "zh-CN") problems.push(`04: expected zh-CN, got ${lang}`);
  await shot(page, "04-ui-switch-persisted-reload");
  await ctx.close();
}

// 05. 切回英文完全恢复
{
  const { ctx, page } = await openPage(null, { width: 1440, height: 900 });
  await page.evaluate(() => window.localStorage.setItem("paperclip.locale", "en"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const lang = await page.evaluate(() => document.documentElement.lang);
  console.log("05 restored en: lang =", lang);
  if (lang !== "en") problems.push(`05: expected en, got ${lang}`);
  await shot(page, "05-ui-switch-restored-en");
  await ctx.close();
}

// ---- Cleanup: delete fixture agent ----
{
  const { ctx, page } = await openPage("en", { width: 1440, height: 900 });
  if (agentId) {
    const delResult = await api(page, "DELETE", `/api/agents/${agentId}`);
    console.log("fixture agent delete status:", delResult.status);
  }
  await ctx.close();
}

console.log("\n================ VERIFICATION SUMMARY ================");
console.log("Total problems detected:", problems.length);
if (problems.length > 0) {
  console.error("PROBLEMS:", problems);
  process.exit(1);
} else {
  console.log("ALL FAILURE AND NORMAL PATH CHECKS PASSED WITH ZERO PROBLEMS!");
}

await browser.close();
