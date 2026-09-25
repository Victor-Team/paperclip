// 第 15 批截图：AdapterManager.tsx 页面标题/列表区与 Install Adapter 对话框。
// 用法：node 交付/第3步/screenshot-batch15-adapter-manager.mjs <输出目录>
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const outDir = process.argv[2];
await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/google-chrome" });
const problems = [];
const BASE = "http://127.0.0.1:3200";
const ADAPTERS = "/ANC/company/settings/instance/adapters";

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
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
}

for (const lng of ["en", "zh"]) {
  const { ctx, page } = await openPage(lng, { width: 1440, height: 1100 }, ADAPTERS);
  const htmlLang = await page.evaluate(() => document.documentElement.lang);
  const expectLang = lng === "zh" ? "zh-CN" : "en";
  console.log(`${lng} html lang=`, htmlLang);
  if (htmlLang !== expectLang) problems.push(`${lng}: html lang ${htmlLang} expected ${expectLang}`);

  const h1 = lng === "zh" ? "适配器" : "Adapters";
  const install = lng === "zh" ? "安装适配器" : "Install Adapter";
  const builtin = lng === "zh" ? "内置适配器" : "Built-in Adapters";
  const alphaNotice = lng === "zh" ? "外部适配器仍处于 Alpha 阶段。" : "External adapters are alpha.";
  const heading = page.getByRole("heading", { name: h1, exact: true }).first();
  await heading.waitFor({ timeout: 15000 });
  const body = await page.evaluate(() => document.body.innerText);
  console.log(`${lng} has h1 ${h1}:`, body.includes(h1));
  console.log(`${lng} has install ${install}:`, body.includes(install));
  console.log(`${lng} has builtin ${builtin}:`, body.includes(builtin));
  console.log(`${lng} has alpha notice:`, body.includes(alphaNotice));
  if (!body.includes(h1)) problems.push(`${lng}: missing page title ${h1}`);
  if (!body.includes(install)) problems.push(`${lng}: missing install button ${install}`);
  if (!body.includes(builtin)) problems.push(`${lng}: missing builtin section ${builtin}`);
  if (!body.includes(alphaNotice)) problems.push(`${lng}: missing alpha notice`);
  if (lng === "zh") {
    if (body.includes("Install Adapter")) problems.push("zh page still shows English Install Adapter");
    if (body.includes("Built-in Adapters")) problems.push("zh page still shows English Built-in Adapters");
  }
  await shot(page, `${lng}-desktop-adapter-list`);

  const installBtn = page.getByRole("button", { name: install, exact: true }).first();
  if (!(await installBtn.count())) {
    problems.push(`${lng}: Install Adapter button not found`);
  } else {
    await installBtn.click();
    await page.waitForTimeout(400);
    const dialogTitle = lng === "zh" ? "安装外部适配器" : "Install External Adapter";
    const npmTab = lng === "zh" ? "npm 软件包" : "npm package";
    const localTab = lng === "zh" ? "本地路径" : "Local path";
    const dialog = page.getByRole("dialog").filter({ hasText: dialogTitle }).first();
    await dialog.waitFor({ timeout: 8000 });
    const dialogText = await dialog.innerText();
    console.log(`${lng} dialog title:`, dialogText.includes(dialogTitle));
    console.log(`${lng} dialog npm tab:`, dialogText.includes(npmTab));
    console.log(`${lng} dialog local tab:`, dialogText.includes(localTab));
    if (!dialogText.includes(dialogTitle)) problems.push(`${lng} dialog missing title`);
    if (!dialogText.includes(npmTab)) problems.push(`${lng} dialog missing npm tab`);
    if (!dialogText.includes(localTab)) problems.push(`${lng} dialog missing local path tab`);
    if (lng === "zh" && dialogText.includes("Install External Adapter")) {
      problems.push("zh dialog still shows English title");
    }
    await shot(page, `${lng}-desktop-install-dialog`);
  }
  await ctx.close();
}

console.log("problems:", problems.length ? problems : "none");
await browser.close();
if (problems.length) process.exitCode = 1;
