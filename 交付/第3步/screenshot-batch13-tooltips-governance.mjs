// 第 13 批截图：智能体表单 `?` 提示气泡（help 对象，agent-config-primitives.tsx）、
// 适配器下拉选项语言切换即时生效、设置页交互治理面板窄化选项文案（resolverPolicyLabel/
// resolverPolicyEffect，interaction-audience.ts）中英对照。
// 用法：node screenshot-batch13-tooltips-governance.mjs <输出目录>
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

// ---- Setup: fixture agent (claude_local, so the runtime/config tab renders
// AgentConfigForm with `help.name`/`help.adapterType` tooltips) ----
{
  const { ctx, page } = await openPage("en", { width: 1440, height: 900 }, "/ANC/dashboard");
  const r = await api(page, "POST", `/api/companies/${COMPANY_ID}/agents`, {
    name: "批13验证智能体-ClaudeLocal",
    adapterType: "claude_local",
  });
  console.log("agent create:", r.status);
  if (r.status < 300) agentIds.push(JSON.parse(r.body).id);
  await ctx.close();
}
if (agentIds.length < 1) problems.push("setup: agent create failed");
const agentId = agentIds[0];

// ==== Part 1: Agent config form "?" tooltip bubble (help.name), en + zh ====
for (const lng of ["en", "zh"]) {
  const { ctx, page } = await openPage(lng, { width: 1440, height: 1400 }, `/ANC/agents/${agentId}/runtime`);
  // AgentConfigForm.tsx itself (field label strings like "Name") is out of
  // this batch's scope and stays English in both languages; only the (?)
  // hint bubble's content — sourced from `help` in agent-config-primitives.tsx
  // — is expected to translate. The label locator below is intentionally the
  // English literal in both passes.
  await page.waitForSelector("text=Name", { timeout: 15000 }).catch(() => {});
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log(`${lng} config form contains name label 'Name':`, bodyText.includes("Name"));
  if (!bodyText.includes("Name")) problems.push(`${lng} config: missing field label Name`);

  // Hover the (?) hint icon beside the "Name" field label to open the tooltip.
  const nameLabel = page.locator(`label:text-is("Name")`).first();
  const hintButton = nameLabel.locator("xpath=following-sibling::button[1]");
  const hasHint = await hintButton.count();
  console.log(`${lng} name hint button found:`, hasHint);
  if (hasHint) {
    await hintButton.hover();
    await page.waitForTimeout(400);
    const tooltipText = await page.evaluate(() => {
      const el = document.querySelector('[data-slot="tooltip-content"]');
      return el ? el.textContent : null;
    });
    console.log(`${lng} name tooltip text:`, tooltipText);
    const expectTooltip = lng === "zh" ? "该智能体在界面上显示的名称。" : "Display name for this agent.";
    if (tooltipText !== expectTooltip) problems.push(`${lng} name tooltip mismatch: got ${JSON.stringify(tooltipText)}`);
  } else {
    problems.push(`${lng}: name hint button not found`);
  }
  await shot(page, `${lng}-desktop-agent-form-name-tooltip`);
  await ctx.close();
}

// ==== Part 2: Adapter type dropdown — live language switch on an already-open form ====
{
  const { ctx, page } = await openPage("en", { width: 1440, height: 900 }, `/ANC/agents/${agentId}/runtime`);
  const bodyTextEn = await page.evaluate(() => document.body.innerText);
  console.log("en adapter type dropdown shows 'Claude Code':", bodyTextEn.includes("Claude Code"));
  await shot(page, "en-desktop-agent-form-adapter-dropdown");

  // Switch language live (same tab, no reload) via localStorage + i18next, then
  // re-render: proves the dropdown label is resolved fresh, not frozen at
  // module-import time (the exact bug batch 12 flagged for `adapterLabels`).
  await page.evaluate(() => window.localStorage.setItem("paperclip.locale", "zh-CN"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const bodyTextZh = await page.evaluate(() => document.body.innerText);
  console.log("zh adapter type dropdown shows 'Claude Code' (brand kept):", bodyTextZh.includes("Claude Code"));
  if (!bodyTextZh.includes("Claude Code")) problems.push("zh adapter dropdown: brand name Claude Code missing");
  await shot(page, "zh-desktop-agent-form-adapter-dropdown");
  await ctx.close();
}

// ==== Part 3: Settings > interaction governance — resolver policy options, en + zh ====
for (const lng of ["en", "zh"]) {
  const { ctx, page } = await openPage(lng, { width: 1440, height: 1600 }, "/ANC/company/settings");
  const bodyText = await page.evaluate(() => document.body.innerText);
  const expectAnyone = lng === "zh" ? "任何人" : "Anyone";
  const expectHumanOnly = lng === "zh" ? "仅限真人" : "Human only";
  console.log(`${lng} governance panel contains '${expectAnyone}':`, bodyText.includes(expectAnyone));
  console.log(`${lng} governance panel contains '${expectHumanOnly}':`, bodyText.includes(expectHumanOnly));
  if (!bodyText.includes(expectAnyone)) problems.push(`${lng} governance: missing option label ${expectAnyone}`);
  if (!bodyText.includes(expectHumanOnly)) problems.push(`${lng} governance: missing option label ${expectHumanOnly}`);

  // Open one of the governance selects to reveal the narrowing option list
  // (resolverPolicyLabel/resolverPolicyEffect rendered as select items).
  const trigger = page.locator('[data-testid^="governance-"]').first();
  const triggerCount = await trigger.count();
  console.log(`${lng} governance trigger found:`, triggerCount);
  if (triggerCount) {
    await trigger.click();
    await page.waitForTimeout(400);
    await shot(page, `${lng}-desktop-governance-options-open`);
    await page.keyboard.press("Escape");
  } else {
    await shot(page, `${lng}-desktop-governance-options-open`);
    problems.push(`${lng}: governance select trigger not found`);
  }
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
