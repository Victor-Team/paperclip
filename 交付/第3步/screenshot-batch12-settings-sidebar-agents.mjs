// 第 12 批截图：设置页侧栏导航（CompanySettingsSidebar + 移动端 CompanySettingsNav）、
// 交互治理面板（InteractionGovernancePanel）、模式徽标（ModeBadge）、
// 席位页适配器标签（adapter-display-registry.ts，用 hermes_gateway 验证 label 会变化）。
// 英/中各一份 + 失败路径回退证据 + 语言切换即时联动/持久化证据。
// 用法：node screenshot-batch12-settings-sidebar-agents.mjs <输出目录>
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

// ---- Setup: fixture agent with a gateway-suffixed adapter type so its label
// text actually differs between locales ("Hermes Gateway" vs "Hermes 网关") ----
{
  const { ctx, page } = await openPage("en", { width: 1440, height: 900 }, "/ANC/dashboard");
  const r = await api(page, "POST", `/api/companies/${COMPANY_ID}/agents`, {
    name: "批12验证智能体-HermesGateway",
    adapterType: "hermes_gateway",
  });
  console.log("agent create:", r.status);
  if (r.status < 300) agentIds.push(JSON.parse(r.body).id);
  await ctx.close();
}
if (agentIds.length < 1) problems.push("setup: agent create failed");

// ==== Part 1: Settings page desktop (sidebar + interaction governance + mode badge), en + zh ====
for (const lng of ["en", "zh"]) {
  const { ctx, page } = await openPage(lng, { width: 1440, height: 2600 }, "/ANC/company/settings");
  const text = await page.evaluate(() => document.body.innerText);
  const expectSidebar = lng === "zh" ? "常规" : "General";
  const expectGovernance = lng === "zh" ? "交互治理" : "Interaction governance";
  const expectBadge = lng === "zh" ? "本地信任" : "Local trusted";
  console.log(`${lng} settings contains sidebar '${expectSidebar}':`, text.includes(expectSidebar));
  console.log(`${lng} settings contains governance '${expectGovernance}':`, text.includes(expectGovernance));
  console.log(`${lng} settings contains mode badge '${expectBadge}':`, text.includes(expectBadge));
  if (!text.includes(expectSidebar)) problems.push(`${lng} settings: missing sidebar label ${expectSidebar}`);
  if (!text.includes(expectGovernance)) problems.push(`${lng} settings: missing governance heading ${expectGovernance}`);
  if (!text.includes(expectBadge)) problems.push(`${lng} settings: missing mode badge ${expectBadge}`);
  await shot(page, `${lng}-desktop-settings-full`);
  await ctx.close();
}

// ==== Part 2: Settings page mobile (CompanySettingsNav tab bar only renders isMobile), en + zh ====
for (const lng of ["en", "zh"]) {
  const { ctx, page } = await openPage(lng, { width: 390, height: 1200 }, "/ANC/company/settings");
  const text = await page.evaluate(() => document.body.innerText);
  const expectTab = lng === "zh" ? "常规" : "General";
  console.log(`${lng} mobile settings contains nav tab '${expectTab}':`, text.includes(expectTab));
  await shot(page, `${lng}-mobile-settings-nav`);
  await ctx.close();
}

// ==== Part 3: Agents page — adapter label translation (Hermes Gateway / Hermes 网关), en + zh ====
for (const lng of ["en", "zh"]) {
  const { ctx, page } = await openPage(lng, { width: 1440, height: 900 }, "/ANC/agents/all");
  const text = await page.evaluate(() => document.body.innerText);
  const expectLabel = lng === "zh" ? "Hermes 网关" : "Hermes Gateway";
  console.log(`${lng} agents page contains adapter label '${expectLabel}':`, text.includes(expectLabel));
  if (!text.includes(expectLabel)) problems.push(`${lng} agents: missing adapter label ${expectLabel}`);
  await shot(page, `${lng}-desktop-agents-adapter-label`);
  await ctx.close();
}

// ==== Part 4: failure paths (先验) ====
{
  const { ctx, page } = await openPage(null, { width: 1440, height: 900 }, "/ANC/company/settings?lng=unknown-locale");
  const lang = await page.evaluate(() => document.documentElement.lang);
  console.log("fail-01 unknown-locale lang=", lang);
  if (lang !== "en") problems.push(`fail-01: expected fallback to en, got ${lang}`);
  await shot(page, "fail-01-unknown-locale-fallback-en");
  await ctx.close();
}
{
  const { ctx, page } = await openPage(null, { width: 1440, height: 900 }, "/ANC/company/settings?lng=zh-cn");
  const lang = await page.evaluate(() => document.documentElement.lang);
  console.log("fail-02 casing zh-cn lang=", lang);
  if (lang !== "en") problems.push(`fail-02: expected fallback to en, got ${lang}`);
  await shot(page, "fail-02-casing-zh-cn-fallback-en");
  await ctx.close();
}
{
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

// ==== Part 5: language switcher persisted across reload ====
{
  const { ctx, page } = await openPage(null, { width: 1440, height: 900 }, "/ANC/company/settings");
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
