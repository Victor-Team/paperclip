// 第 16 批截图：PluginManager.tsx 页面标题/列表区与 Install Plugin 对话框。
// 用法：node 交付/第3步/screenshot-batch16-plugin-manager.mjs <输出目录>
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const outDir = process.argv[2];
await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/google-chrome" });
const problems = [];
const BASE = "http://127.0.0.1:3200";
const PLUGINS = "/ANC/company/settings/instance/plugins";

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
  const { ctx, page } = await openPage(lng, { width: 1440, height: 1100 }, PLUGINS);
  const htmlLang = await page.evaluate(() => document.documentElement.lang);
  const expectLang = lng === "zh" ? "zh-CN" : "en";
  console.log(`${lng} html lang=`, htmlLang);
  if (htmlLang !== expectLang) problems.push(`${lng}: html lang ${htmlLang} expected ${expectLang}`);

  const h1 = lng === "zh" ? "插件管理" : "Plugin Manager";
  const install = lng === "zh" ? "安装插件" : "Install Plugin";
  const available = lng === "zh" ? "可用插件" : "Available Plugins";
  const bundled = lng === "zh" ? "内置" : "Bundled";
  const installed = lng === "zh" ? "已安装插件" : "Installed Plugins";
  const alphaNotice = lng === "zh" ? "插件仍处于 Alpha 阶段。" : "Plugins are alpha.";
  const heading = page.getByRole("heading", { name: h1, exact: true }).first();
  await heading.waitFor({ timeout: 15000 });
  const body = await page.evaluate(() => document.body.innerText);
  console.log(`${lng} has h1 ${h1}:`, body.includes(h1));
  console.log(`${lng} has install ${install}:`, body.includes(install));
  console.log(`${lng} has available ${available}:`, body.includes(available));
  console.log(`${lng} has bundled ${bundled}:`, body.includes(bundled));
  console.log(`${lng} has installed ${installed}:`, body.includes(installed));
  console.log(`${lng} has alpha notice:`, body.includes(alphaNotice));
  if (!body.includes(h1)) problems.push(`${lng}: missing page title ${h1}`);
  if (!body.includes(install)) problems.push(`${lng}: missing install button ${install}`);
  if (!body.includes(available)) problems.push(`${lng}: missing available section ${available}`);
  if (!body.includes(bundled)) problems.push(`${lng}: missing bundled badge ${bundled}`);
  if (!body.includes(installed)) problems.push(`${lng}: missing installed section ${installed}`);
  if (!body.includes(alphaNotice)) problems.push(`${lng}: missing alpha notice`);
  if (lng === "zh") {
    if (body.includes("Install Plugin")) problems.push("zh page still shows English Install Plugin");
    if (body.includes("Available Plugins")) problems.push("zh page still shows English Available Plugins");
    if (body.includes("Plugin Manager")) problems.push("zh page still shows English Plugin Manager");
  }
  await shot(page, `${lng}-desktop-plugin-list`);

  const installBtn = page.getByRole("button", { name: install, exact: true }).first();
  if (!(await installBtn.count())) {
    problems.push(`${lng}: Install Plugin button not found`);
  } else {
    await installBtn.click();
    await page.waitForTimeout(400);
    const dialogTitle = lng === "zh" ? "安装插件" : "Install Plugin";
    const npmLabel = lng === "zh" ? "npm 软件包名称" : "npm Package Name";
    const cancel = lng === "zh" ? "取消" : "Cancel";
    const dialog = page.getByRole("dialog").filter({ hasText: dialogTitle }).first();
    await dialog.waitFor({ timeout: 8000 });
    const dialogText = await dialog.innerText();
    console.log(`${lng} dialog title:`, dialogText.includes(dialogTitle));
    console.log(`${lng} dialog npm label:`, dialogText.includes(npmLabel));
    console.log(`${lng} dialog cancel:`, dialogText.includes(cancel));
    if (!dialogText.includes(dialogTitle)) problems.push(`${lng} dialog missing title`);
    if (!dialogText.includes(npmLabel)) problems.push(`${lng} dialog missing npm package name`);
    if (!dialogText.includes(cancel)) problems.push(`${lng} dialog missing cancel`);
    if (lng === "zh" && dialogText.includes("Enter the npm package name of the plugin you wish to install.")) {
      problems.push("zh dialog still shows English description");
    }
    await shot(page, `${lng}-desktop-install-dialog`);
  }
  await ctx.close();
}

console.log("problems:", problems.length ? problems : "none");
await browser.close();
if (problems.length) process.exitCode = 1;
