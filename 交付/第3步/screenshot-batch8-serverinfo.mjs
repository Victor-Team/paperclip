// 第 8 批截图：账号菜单里的服务器信息调试面板（enableServerInfoDebugView）。英/中各一份，
// 外加恢复默认设置后的一张常规账号菜单截图，证明关闭调试面板时不受影响。
// 用法：node screenshot-batch8-serverinfo.mjs <输出目录>
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

async function openPage(lng, viewport) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const tag = `${lng}-${viewport.width}`;
  page.on("console", (m) => { if (m.type() === "error") problems.push(`${tag} console: ${m.text()}`); });
  page.on("pageerror", (e) => problems.push(`${tag} pageerror: ${e.message}`));
  page.on("response", (r) => { if (r.status() >= 400) problems.push(`${tag} http ${r.status()} ${r.url()}`); });
  await page.goto(`${BASE}/ANC/dashboard${lng === "zh" ? "?lng=zh-CN" : ""}`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1000);
  return { ctx, page };
}

async function shot(page, name) {
  const lang = await page.evaluate(() => document.documentElement.lang);
  console.log(name, "lang=", lang);
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
}

async function setServerInfoDebug(page, enabled) {
  const r = await api(page, "PATCH", "/api/instance/settings/experimental", { enableServerInfoDebugView: enabled });
  if (r.status >= 300) problems.push(`setServerInfoDebug(${enabled}) failed: ${r.status} ${r.body}`);
}

async function openAccountMenu(page) {
  const trigger = page.locator('button[aria-label="Open account menu"], button[aria-label="打开账号菜单"]').first();
  if (await trigger.count() === 0) {
    problems.push("account menu trigger not found");
    return false;
  }
  await trigger.click({ force: true });
  await page.waitForTimeout(600);
  return true;
}

let agentId = null;

// ---- Setup: create a fixture agent (empty company shows onboarding, not the dashboard chrome) ----
{
  const { ctx, page } = await openPage("en", { width: 1440, height: 900 });
  const agentResult = await api(page, "POST", `/api/companies/${COMPANY_ID}/agents`, { name: "批8验证智能体", adapterType: "process" });
  console.log("agent create:", agentResult.status);
  if (agentResult.status < 300) agentId = JSON.parse(agentResult.body).id;
  await setServerInfoDebug(page, true);
  await ctx.close();
}
if (!agentId) problems.push("setup: agent create failed");

// ==== Part 1: server info panel visible in account menu, en + zh ====
for (const lng of ["en", "zh"]) {
  const { ctx, page } = await openPage(lng, { width: 1440, height: 900 });
  const opened = await openAccountMenu(page);
  if (opened) {
    // Poll briefly so the health query (2s interval while open) resolves past "Loading...".
    await page.waitForTimeout(1500);
    const text = await page.evaluate(() => {
      const p = [...document.querySelectorAll("p")].find((el) => /^(Server|服务器)$/.test(el.textContent?.trim() ?? ""));
      return p ? p.parentElement?.innerText ?? null : null;
    });
    console.log(`${lng} server-info-block:`, JSON.stringify(text));
    if (!text) problems.push(`${lng}: server info block not found in account menu`);
    await shot(page, `${lng}-desktop-account-menu-serverinfo`);
  }
  await ctx.close();
}

// ==== Part 2: default (debug view off) sanity screenshot, en only ====
{
  const { ctx, page } = await openPage("en", { width: 1440, height: 900 });
  await setServerInfoDebug(page, false);
  await ctx.close();
}
{
  const { ctx, page } = await openPage("en", { width: 1440, height: 900 });
  const opened = await openAccountMenu(page);
  if (opened) {
    await page.waitForTimeout(400);
    await shot(page, "en-desktop-account-menu-default-no-serverinfo");
  }
  await ctx.close();
}

// ---- Restore default + cleanup fixture ----
{
  const { ctx, page } = await openPage("en", { width: 1440, height: 900 });
  if (agentId) console.log("agent delete:", (await api(page, "DELETE", `/api/agents/${agentId}`)).status);
  await ctx.close();
}

console.log("problems:", problems.length ? problems : "none");
await browser.close();
