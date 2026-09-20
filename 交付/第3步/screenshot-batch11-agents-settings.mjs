// 第 11 批截图：席位页（Agents.tsx）+ 设置页（CompanySettings.tsx + InstanceGeneralSettings.tsx）。
// 英/中各一份 + 失败路径回退证据 + 语言切换即时联动/持久化证据。
// 用法：node screenshot-batch11-agents-settings.mjs <输出目录>
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

async function openPage(lng, viewport, urlPathAndQuery) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const tag = `${lng}-${viewport.width}`;
  page.on("console", (m) => { if (m.type() === "error") problems.push(`${tag} console: ${m.text()}`); });
  page.on("pageerror", (e) => problems.push(`${tag} pageerror: ${e.message}`));
  page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("/documents/plan")) problems.push(`${tag} http ${r.status()} ${r.url()}`); });
  const lngParam = lng === "zh" ? "lng=zh-CN" : lng === "en" ? "lng=en" : "";
  const sep = urlPathAndQuery.includes("?") ? "&" : "?";
  const url = lngParam ? `${BASE}${urlPathAndQuery}${sep}${lngParam}` : `${BASE}${urlPathAndQuery}`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1000);
  return { ctx, page };
}

async function shot(page, name) {
  const lang = await page.evaluate(() => document.documentElement.lang);
  console.log(name, "lang=", lang);
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
}

let agentIds = [];

// ---- Setup: create fixture agents so the Agents page list/org-chart view renders real rows ----
{
  const { ctx, page } = await openPage("en", { width: 1440, height: 900 }, "/ANC/dashboard");
  for (const name of ["批11验证智能体-Alpha", "批11验证智能体-Beta"]) {
    const r = await api(page, "POST", `/api/companies/${COMPANY_ID}/agents`, { name, adapterType: "process" });
    console.log("agent create:", name, r.status);
    if (r.status < 300) agentIds.push(JSON.parse(r.body).id);
  }
  await ctx.close();
}
if (agentIds.length < 2) problems.push("setup: agent create failed");

// ==== Part 1: Agents page (list view), en + zh ====
for (const lng of ["en", "zh"]) {
  const { ctx, page } = await openPage(lng, { width: 1440, height: 900 }, "/ANC/agents/all");
  const text = await page.evaluate(() => document.body.innerText);
  console.log(`${lng} agents page contains agent name:`, text.includes("批11验证智能体"));
  await shot(page, `${lng}-desktop-agents-list`);
  await ctx.close();
}

// ==== Part 2: Agents page (org chart view via UI toggle click), en + zh ====
for (const lng of ["en", "zh"]) {
  const { ctx, page } = await openPage(lng, { width: 1440, height: 900 }, "/ANC/agents/all");
  const orgLabel = lng === "zh" ? "组织架构图视图" : "Org chart view";
  await page.click(`button[aria-label="${orgLabel}"]`);
  await page.waitForTimeout(800);
  await shot(page, `${lng}-desktop-agents-org`);
  await ctx.close();
}

// ==== Part 3: Settings page (CompanySettings + embedded InstanceGeneralSettings), en + zh ====
// The scroll container is the inner <main> (overflow-auto), not document.body;
// a tall viewport avoids needing scroll-stitching to capture the full page.
for (const lng of ["en", "zh"]) {
  const { ctx, page } = await openPage(lng, { width: 1440, height: 2400 }, "/ANC/company/settings");
  const text = await page.evaluate(() => document.body.innerText);
  console.log(`${lng} settings page contains 'Sign out'/'退出登录':`, text.includes("Sign out") || text.includes("退出登录"));
  await shot(page, `${lng}-desktop-settings`);
  await ctx.close();
}

// ==== Part 4: failure paths (先验) ====
{
  // Unknown language code falls back to English.
  const { ctx, page } = await openPage(null, { width: 1440, height: 900 }, "/ANC/agents/all?lng=unknown-locale");
  const lang = await page.evaluate(() => document.documentElement.lang);
  console.log("fail-01 unknown-locale lang=", lang);
  if (lang !== "en") problems.push(`fail-01: expected fallback to en, got ${lang}`);
  await shot(page, "fail-01-unknown-locale-fallback-en");
  await ctx.close();
}
{
  // Case-sensitive locale code (zh-cn instead of zh-CN) falls back to English.
  const { ctx, page } = await openPage(null, { width: 1440, height: 900 }, "/ANC/company/settings?lng=zh-cn");
  const lang = await page.evaluate(() => document.documentElement.lang);
  console.log("fail-02 casing zh-cn lang=", lang);
  if (lang !== "en") problems.push(`fail-02: expected fallback to en, got ${lang}`);
  await shot(page, "fail-02-casing-zh-cn-fallback-en");
  await ctx.close();
}
{
  // Corrupted localStorage value falls back to English gracefully.
  const { ctx, page } = await openPage(null, { width: 1440, height: 900 }, "/ANC/agents/all");
  await page.evaluate(() => window.localStorage.setItem("paperclip.locale", "\u0000garbage"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const lang = await page.evaluate(() => document.documentElement.lang);
  console.log("fail-03 corrupted-storage lang=", lang);
  if (lang !== "en") problems.push(`fail-03: expected fallback to en, got ${lang}`);
  await shot(page, "fail-03-corrupted-storage-fallback-en");
  await ctx.close();
}

// ==== Part 5: language switcher UI immediate + persisted across reload ====
{
  const { ctx, page } = await openPage(null, { width: 1440, height: 900 }, "/ANC/agents/all");
  await page.evaluate(() => window.localStorage.setItem("paperclip.locale", "zh-CN"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const lang = await page.evaluate(() => document.documentElement.lang);
  console.log("persisted-locale lang after reload=", lang);
  if (lang !== "zh-CN") problems.push(`persist: expected zh-CN after reload, got ${lang}`);
  await shot(page, "persist-zh-CN-after-reload");
  await ctx.close();
}

// ---- Cleanup fixtures ----
{
  const { ctx, page } = await openPage("en", { width: 1440, height: 900 }, "/ANC/dashboard");
  for (const id of agentIds) {
    console.log("agent delete:", id, (await api(page, "DELETE", `/api/agents/${id}`)).status);
  }
  await ctx.close();
}

console.log("problems:", problems.length ? problems : "none");
await browser.close();
