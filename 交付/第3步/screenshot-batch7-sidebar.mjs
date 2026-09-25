// 第 7 批 侧栏下半部截图：智能体列表（classic 布局，enableStreamlinedUi=false）、
// 最近任务与已加星标项目（streamlined 布局，默认 enableStreamlinedUi=true）。英/中各一份。
// 用法：node screenshot-batch7-sidebar.mjs <输出目录>
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
  await page.waitForTimeout(1200);
  return { ctx, page };
}

async function shot(page, name) {
  const lang = await page.evaluate(() => document.documentElement.lang);
  const popup = await page.evaluate(() =>
    [...document.querySelectorAll('[role="menu"], [data-radix-popper-content-wrapper]')].map((e) => e.innerText.replace(/\n+/g, " | ")));
  console.log(name, "lang=", lang, "popup=", JSON.stringify(popup));
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
}

async function setStreamlined(page, enabled) {
  const r = await api(page, "PATCH", "/api/instance/settings/experimental", { enableStreamlinedUi: enabled });
  if (r.status >= 300) problems.push(`setStreamlined(${enabled}) failed: ${r.status} ${r.body}`);
}

let agentId = null;
let issueId = null;
let projectId = null;

// ---- Setup: create fixtures via same-origin fetch on an authenticated page. ----
{
  const { ctx, page } = await openPage("en", { width: 1440, height: 900 });
  const agentResult = await api(page, "POST", `/api/companies/${COMPANY_ID}/agents`, { name: "批7验证智能体", adapterType: "process" });
  console.log("agent create:", agentResult.status);
  if (agentResult.status < 300) agentId = JSON.parse(agentResult.body).id;

  const issueResult = await api(page, "POST", `/api/companies/${COMPANY_ID}/issues`, { title: "批7验证任务" });
  console.log("issue create:", issueResult.status);
  if (issueResult.status < 300) issueId = JSON.parse(issueResult.body).id;

  const projectResult = await api(page, "POST", `/api/companies/${COMPANY_ID}/projects`, { name: "批7验证项目" });
  console.log("project create:", projectResult.status, projectResult.body.slice(0, 200));
  if (projectResult.status < 300) {
    projectId = JSON.parse(projectResult.body).id;
    const starResult = await api(page, "PUT", `/api/companies/${COMPANY_ID}/resource-memberships/me/projects/${projectId}`, { starred: true });
    console.log("project star:", starResult.status, starResult.body.slice(0, 200));
  }
  await ctx.close();
}
if (!agentId) problems.push("setup: agent create failed");
if (!issueId) problems.push("setup: issue create failed");
if (!projectId) problems.push("setup: project create failed");

// ==== Part 1: streamlined layout (default true) — Recent Tasks + Starred Projects ====
for (const lng of ["en", "zh"]) {
  const { ctx, page } = await openPage(lng, { width: 1440, height: 900 });
  if (issueId) {
    await page.goto(`${BASE}/ANC/issues/${issueId}${lng === "zh" ? "?lng=zh-CN" : ""}`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(600);
    await page.goto(`${BASE}/ANC/dashboard${lng === "zh" ? "?lng=zh-CN" : ""}`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1000);
  }
  await shot(page, `${lng}-desktop-streamlined-sidebar`);

  const taskMoreBtn = page.locator('button[aria-label^="More actions for"], button[aria-label$="的更多操作"]').first();
  if (await taskMoreBtn.count()) {
    await taskMoreBtn.click({ force: true });
    await page.waitForTimeout(500);
    await shot(page, `${lng}-desktop-recent-task-menu`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  } else {
    problems.push(`${lng}: recent task more-actions button not found`);
  }

  const projectMoreBtn = page.locator('button[aria-label^="Open actions for"], button[aria-label^="打开"][aria-label$="的操作菜单"]').first();
  if (await projectMoreBtn.count()) {
    // Desktop uses a hover-revealed inline star toggle, not a menu button; the
    // mobile "..." menu only renders when isMobile, so just confirm the row itself.
    await shot(page, `${lng}-desktop-starred-project-row`);
  } else {
    await shot(page, `${lng}-desktop-starred-project-row`);
  }
  await ctx.close();
}

// ==== Part 2: classic layout (enableStreamlinedUi=false) — Agents list ====
{
  const { ctx, page } = await openPage("en", { width: 1440, height: 900 });
  await setStreamlined(page, false);
  await ctx.close();
}

for (const lng of ["en", "zh"]) {
  const { ctx, page } = await openPage(lng, { width: 1440, height: 900 });
  await shot(page, `${lng}-desktop-classic-sidebar`);

  const sectionMenuBtn = page.locator('button[aria-label="Agents section actions"], button[aria-label="智能体操作菜单"]').first();
  if (await sectionMenuBtn.count()) {
    await sectionMenuBtn.click({ force: true });
    await page.waitForTimeout(500);
    await shot(page, `${lng}-desktop-agents-section-menu`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  } else {
    problems.push(`${lng}: Agents section actions button not found`);
  }

  const agentMoreBtn = page.locator('button[aria-label^="Open actions for"], button[aria-label^="打开"][aria-label$="的操作菜单"]').first();
  if (await agentMoreBtn.count()) {
    await agentMoreBtn.click({ force: true });
    await page.waitForTimeout(500);
    await shot(page, `${lng}-desktop-agent-menu`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  } else {
    problems.push(`${lng}: agent row more-actions button not found`);
  }
  await ctx.close();
}

// ---- Restore default + cleanup fixtures ----
{
  const { ctx, page } = await openPage("en", { width: 1440, height: 900 });
  await setStreamlined(page, true);
  if (agentId) console.log("agent delete:", (await api(page, "DELETE", `/api/agents/${agentId}`)).status);
  if (issueId) console.log("issue delete:", (await api(page, "DELETE", `/api/issues/${issueId}`)).status);
  if (projectId) console.log("project delete:", (await api(page, "DELETE", `/api/projects/${projectId}?companyId=${COMPANY_ID}`)).status);
  await ctx.close();
}

await browser.close();
console.log("problems:", problems.length ? problems : "none");
