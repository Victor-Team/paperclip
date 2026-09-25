// 第 17 批截图：ProfileSettings 整页与收件箱整理策略「仅所选智能体」草稿态。
// 只改界面草稿、不点保存、不上传头像。
// 用法：node 交付/第3步/screenshot-batch17-profile-settings.mjs <输出目录>
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const outDir = process.argv[2];
await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/google-chrome" });
const problems = [];
const BASE = "http://127.0.0.1:3200";
const PROFILE = "/ANC/company/settings/instance/profile";

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
  const { ctx, page } = await openPage(lng, { width: 1440, height: 1100 }, PROFILE);
  const htmlLang = await page.evaluate(() => document.documentElement.lang);
  const expectLang = lng === "zh" ? "zh-CN" : "en";
  console.log(`${lng} html lang=`, htmlLang);
  if (htmlLang !== expectLang) problems.push(`${lng}: html lang ${htmlLang} expected ${expectLang}`);

  const h1 = lng === "zh" ? "个人资料" : "Profile";
  const displayName = lng === "zh" ? "显示名称" : "Display name";
  const email = lng === "zh" ? "电子邮箱" : "Email";
  const saveProfile = lng === "zh" ? "保存个人资料" : "Save profile";
  const tidy = lng === "zh" ? "允许智能体整理我的收件箱" : "Let agents tidy my inbox";
  const anyAgents = lng === "zh" ? "我的任一智能体" : "Any of my agents";
  const onlyChosen = lng === "zh" ? "仅所选智能体" : "Only chosen agents";
  const off = lng === "zh" ? "关闭" : "Off";
  const heading = page.getByRole("heading", { name: h1, exact: true }).first();
  await heading.waitFor({ timeout: 15000 });
  const body = await page.evaluate(() => document.body.innerText);
  console.log(`${lng} has h1 ${h1}:`, body.includes(h1));
  console.log(`${lng} has displayName:`, body.includes(displayName));
  console.log(`${lng} has email:`, body.includes(email));
  console.log(`${lng} has saveProfile:`, body.includes(saveProfile));
  console.log(`${lng} has tidy:`, body.includes(tidy));
  console.log(`${lng} has anyAgents:`, body.includes(anyAgents));
  console.log(`${lng} has onlyChosen:`, body.includes(onlyChosen));
  console.log(`${lng} has off:`, body.includes(off));
  if (!body.includes(h1)) problems.push(`${lng}: missing page title ${h1}`);
  if (!body.includes(displayName)) problems.push(`${lng}: missing display name`);
  if (!body.includes(email)) problems.push(`${lng}: missing email`);
  if (!body.includes(saveProfile)) problems.push(`${lng}: missing save profile`);
  if (!body.includes(tidy)) problems.push(`${lng}: missing inbox policy title`);
  if (!body.includes(anyAgents)) problems.push(`${lng}: missing any-agents option`);
  if (!body.includes(onlyChosen)) problems.push(`${lng}: missing only-chosen option`);
  if (!body.includes(off)) problems.push(`${lng}: missing off option`);
  if (lng === "zh") {
    if (body.includes("Display name")) problems.push("zh page still shows English Display name");
    if (body.includes("Save profile")) problems.push("zh page still shows English Save profile");
    if (body.includes("Let agents tidy my inbox")) problems.push("zh page still shows English inbox policy title");
  }
  await shot(page, `${lng}-desktop-profile`);

  const chosen = page.getByRole("radio", { name: onlyChosen }).first();
  if (!(await chosen.count())) {
    problems.push(`${lng}: Only chosen agents radio not found`);
  } else {
    await chosen.click();
    await page.waitForTimeout(400);
    const allowed = lng === "zh" ? "允许整理我的收件箱的智能体" : "Agents allowed to tidy my inbox";
    const selectAgents = lng === "zh" ? "选择智能体" : "Select agents";
    const after = await page.evaluate(() => document.body.innerText);
    console.log(`${lng} has allowed label:`, after.includes(allowed));
    console.log(`${lng} has select agents:`, after.includes(selectAgents));
    if (!after.includes(allowed)) problems.push(`${lng}: missing allowlist label`);
    if (!after.includes(selectAgents)) problems.push(`${lng}: missing select-agents trigger`);
    if (lng === "zh" && after.includes("Select agents")) {
      problems.push("zh allowlist still shows English Select agents");
    }
    await shot(page, `${lng}-desktop-allowlist-draft`);
  }
  await ctx.close();
}

console.log("problems:", problems.length ? problems : "none");
await browser.close();
if (problems.length) process.exitCode = 1;
