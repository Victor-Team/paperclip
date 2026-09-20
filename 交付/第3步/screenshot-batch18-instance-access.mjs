// 第 18 批截图：InstanceAccess 整页与选中用户后的权限详情。
// 只浏览和搜索，不点保存、不升降管理员。
// 用法：node 交付/第3步/screenshot-batch18-instance-access.mjs <输出目录>
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const outDir = process.argv[2];
await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/google-chrome" });
const problems = [];
const BASE = "http://127.0.0.1:3200";
const ACCESS = "/ANC/company/settings/instance/access";

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
  const { ctx, page } = await openPage(lng, { width: 1440, height: 1100 }, ACCESS);
  const htmlLang = await page.evaluate(() => document.documentElement.lang);
  const expectLang = lng === "zh" ? "zh-CN" : "en";
  console.log(`${lng} html lang=`, htmlLang);
  if (htmlLang !== expectLang) problems.push(`${lng}: html lang ${htmlLang} expected ${expectLang}`);

  const h1 = lng === "zh" ? "实例访问权限" : "Instance Access";
  const searchUsers = lng === "zh" ? "搜索用户" : "Search users";
  const orgAccess = lng === "zh" ? "公司访问权限" : "Organization access";
  const current = lng === "zh" ? "当前成员关系" : "Current memberships";
  const save = lng === "zh" ? "保存公司访问权限" : "Save organization access";
  const heading = page.getByRole("heading", { name: h1, exact: true }).first();
  await heading.waitFor({ timeout: 15000 });
  const body = await page.evaluate(() => document.body.innerText);
  console.log(`${lng} has h1 ${h1}:`, body.includes(h1));
  console.log(`${lng} has searchUsers:`, body.includes(searchUsers));
  console.log(`${lng} has orgAccess:`, body.includes(orgAccess));
  console.log(`${lng} has current:`, body.includes(current));
  console.log(`${lng} has save:`, body.includes(save));
  if (!body.includes(h1)) problems.push(`${lng}: missing page title ${h1}`);
  if (!body.includes(searchUsers)) problems.push(`${lng}: missing search users`);
  if (lng === "zh") {
    if (body.includes("Instance Access")) problems.push("zh page still shows English Instance Access");
    if (body.includes("Search users")) problems.push("zh page still shows English Search users");
    if (body.includes("Organization access")) problems.push("zh page still shows English Organization access");
    if (body.includes("Current memberships")) problems.push("zh page still shows English Current memberships");
    if (body.includes("Save organization access")) problems.push("zh page still shows English Save organization access");
  }
  await shot(page, `${lng}-desktop-access`);

  const userButtons = page.locator("button").filter({ has: page.locator(".truncate.font-medium") });
  const userCount = await userButtons.count();
  console.log(`${lng} user buttons:`, userCount);
  if (userCount === 0) {
    problems.push(`${lng}: no user rows to select`);
  } else {
    const targetIndex = userCount > 1 ? 1 : 0;
    await userButtons.nth(targetIndex).click();
    await page.waitForTimeout(600);
    const after = await page.evaluate(() => document.body.innerText);
    console.log(`${lng} detail has orgAccess:`, after.includes(orgAccess));
    console.log(`${lng} detail has current:`, after.includes(current));
    console.log(`${lng} detail has save:`, after.includes(save));
    if (!after.includes(orgAccess)) problems.push(`${lng}: missing organization access after select`);
    if (!after.includes(current)) problems.push(`${lng}: missing current memberships after select`);
    if (!after.includes(save)) problems.push(`${lng}: missing save button after select`);
    if (lng === "zh" && after.includes("Promote to instance admin")) {
      problems.push("zh detail still shows English Promote to instance admin");
    }
    if (lng === "zh" && after.includes("Remove instance admin")) {
      problems.push("zh detail still shows English Remove instance admin");
    }
    await shot(page, `${lng}-desktop-user-detail`);
  }
  await ctx.close();
}

console.log("problems:", problems.length ? problems : "none");
await browser.close();
if (problems.length) process.exitCode = 1;
