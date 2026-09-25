// 第 20 批截图：组织列表卡片、三点菜单、删除确认条。
// 只打开确认条，不点最终删除；不重命名、不解除归档、不新建组织。
// 用法：node 交付/第3步/screenshot-batch20-companies.mjs <输出目录>
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const outDir = process.argv[2];
await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/google-chrome" });
const problems = [];
const BASE = "http://127.0.0.1:3200";
const COMPANIES = "/ANC/companies";

async function openPage(lng, viewport, urlPathAndQuery) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const tag = `${lng}-${viewport.width}`;
  page.on("console", (m) => { if (m.type() === "error") problems.push(`${tag} console: ${m.text()}`); });
  page.on("pageerror", (e) => problems.push(`${tag} pageerror: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 400 && !r.url().includes("/documents/plan")) {
      problems.push(`${tag} http ${r.status()} ${r.url()}`);
    }
  });
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
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
}

for (const lng of ["en", "zh"]) {
  const { ctx, page } = await openPage(lng, { width: 1440, height: 1100 }, COMPANIES);
  const htmlLang = await page.evaluate(() => document.documentElement.lang);
  const expectLang = lng === "zh" ? "zh-CN" : "en";
  console.log(`${lng} html lang=`, htmlLang);
  if (htmlLang !== expectLang) problems.push(`${lng}: html lang ${htmlLang} expected ${expectLang}`);

  const newOrg = lng === "zh" ? "新建公司" : "New Organization";
  const moreActions = lng === "zh" ? "更多操作" : "More actions";
  const rename = lng === "zh" ? "重命名" : "Rename";
  const deleteOrg = lng === "zh" ? "删除公司" : "Delete Organization";
  const deleteConfirm = lng === "zh"
    ? "删除这家公司及其全部数据？此操作无法撤销。"
    : "Delete this organization and all its data? This cannot be undone.";
  const cancel = lng === "zh" ? "取消" : "Cancel";
  const statusActive = lng === "zh" ? "活跃" : "Active";
  const unlimited = lng === "zh" ? "预算不限" : "Unlimited budget";
  const created = lng === "zh" ? "创建于" : "Created ";

  const body = await page.evaluate(() => document.body.innerText);
  console.log(`${lng} has newOrg:`, body.includes(newOrg));
  console.log(`${lng} has statusActive:`, body.includes(statusActive));
  console.log(`${lng} has unlimited:`, body.includes(unlimited));
  console.log(`${lng} has created:`, body.includes(created));
  if (!body.includes(newOrg)) problems.push(`${lng}: missing New Organization`);
  if (!body.includes(statusActive) && !body.includes(lng === "zh" ? "已归档" : "Archived") && !body.includes(lng === "zh" ? "已暂停" : "Paused")) {
    problems.push(`${lng}: missing company status label`);
  }
  if (lng === "zh") {
    if (body.includes("New Organization")) problems.push("zh page still shows English New Organization");
    if (body.includes("Unlimited budget")) problems.push("zh page still shows English Unlimited budget");
    if (body.includes("Loading organizations...")) problems.push("zh page still shows English loading state");
  }

  await shot(page, `${lng}-desktop-companies`);

  const card = page.locator('[role="button"]').filter({ has: page.locator("h3") }).first();
  await card.hover();
  await page.waitForTimeout(200);
  const moreButton = page.locator(`button[aria-label="${moreActions}"]`).first();
  if (await moreButton.count() === 0) {
    problems.push(`${lng}: missing more-actions button aria-label=${moreActions}`);
  } else {
    await moreButton.click();
    await page.waitForTimeout(400);
    const open = await page.evaluate(() => document.body.innerText);
    console.log(`${lng} menu has Rename:`, open.includes(rename));
    console.log(`${lng} menu has Delete Organization:`, open.includes(deleteOrg));
    if (!open.includes(rename)) problems.push(`${lng}: missing Rename in menu`);
    if (!open.includes(deleteOrg)) problems.push(`${lng}: missing Delete Organization in menu`);
    if (lng === "zh" && open.includes("Delete Organization")) {
      problems.push("zh menu still shows English Delete Organization");
    }
    await shot(page, `${lng}-desktop-menu`);

    await page.getByRole("menuitem", { name: deleteOrg }).click();
    await page.waitForTimeout(400);
    const confirm = await page.evaluate(() => document.body.innerText);
    console.log(`${lng} has deleteConfirm:`, confirm.includes(deleteConfirm));
    console.log(`${lng} has cancel:`, confirm.includes(cancel));
    if (!confirm.includes(deleteConfirm)) problems.push(`${lng}: missing delete confirm copy`);
    if (!confirm.includes(cancel)) problems.push(`${lng}: missing Cancel on confirm bar`);
    if (lng === "zh" && confirm.includes("This cannot be undone.")) {
      problems.push("zh confirm still shows English undo warning");
    }
    await shot(page, `${lng}-desktop-delete-confirm`);
  }

  await ctx.close();
}

console.log("problems:", problems.length ? problems : "none");
await browser.close();
if (problems.length) process.exitCode = 1;
