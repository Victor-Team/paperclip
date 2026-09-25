// 第 14 批截图：PathInstructionsModal.tsx 的 Choose 按钮与路径说明弹窗，
// 在真实消费点 AdapterManager「安装适配器 → 本地路径」里打开。
// 用法：node 交付/第3步/screenshot-batch14-path-modal.mjs <输出目录>
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

async function openChooseSurface(page, lng) {
  const install = page.getByRole("button", { name: /Install Adapter/i }).first();
  await install.waitFor({ timeout: 15000 });
  await install.click();
  await page.waitForTimeout(400);

  const localPath = page.getByRole("button", { name: /Local path/i }).first();
  await localPath.waitFor({ timeout: 8000 });
  await localPath.click();
  await page.waitForTimeout(300);

  const chooseLabel = lng === "zh" ? "选择" : "Choose";
  const choose = page.getByRole("button", { name: chooseLabel, exact: true }).first();
  const count = await choose.count();
  console.log(`${lng} Choose button count:`, count, "label=", chooseLabel);
  if (!count) problems.push(`${lng}: Choose button not found`);
  return choose;
}

for (const lng of ["en", "zh"]) {
  const { ctx, page } = await openPage(lng, { width: 1440, height: 1100 }, ADAPTERS);
  const htmlLang = await page.evaluate(() => document.documentElement.lang);
  const expectLang = lng === "zh" ? "zh-CN" : "en";
  console.log(`${lng} html lang=`, htmlLang);
  if (htmlLang !== expectLang) problems.push(`${lng}: html lang ${htmlLang} expected ${expectLang}`);

  const choose = await openChooseSurface(page, lng);
  if (await choose.count()) {
    await choose.scrollIntoViewIfNeeded();
    await shot(page, `${lng}-desktop-choose-button`);

    await choose.click();
    await page.waitForTimeout(500);
    const title = lng === "zh" ? "如何获取完整路径" : "How to get a full path";
    const dialog = page.getByRole("dialog").filter({ hasText: title }).first();
    const dialogCount = await dialog.count();
    console.log(`${lng} path modal count:`, dialogCount);
    if (!dialogCount) {
      problems.push(`${lng}: path modal not found after clicking Choose`);
      await shot(page, `${lng}-desktop-path-modal`);
    } else {
      const body = await dialog.innerText();
      const expectPaste = lng === "zh" ? "将绝对路径（例如" : "Paste the absolute path (e.g.";
      if (!body.includes(title)) problems.push(`${lng} modal missing title ${title}`);
      if (!body.includes(expectPaste)) problems.push(`${lng} modal missing description ${expectPaste}`);
      console.log(`${lng} modal has title:`, body.includes(title));
      console.log(`${lng} modal has description:`, body.includes(expectPaste));

      // Default detected platform on Linux headless Chrome is linux; switch
      // to Windows so the screenshot shows a non-default tab state.
      const windowsTab = dialog.getByRole("button", { name: "Windows" }).first();
      if (await windowsTab.count()) {
        await windowsTab.click();
        await page.waitForTimeout(200);
      }
      const after = await dialog.innerText();
      const expectWindowsStep = lng === "zh"
        ? "打开文件资源管理器并进入该文件夹。"
        : "Open File Explorer and navigate to the folder.";
      console.log(`${lng} windows step visible:`, after.includes(expectWindowsStep));
      if (!after.includes(expectWindowsStep)) problems.push(`${lng} modal missing Windows step`);
      await shot(page, `${lng}-desktop-path-modal-windows`);
    }
  } else {
    await shot(page, `${lng}-desktop-choose-button`);
  }
  await ctx.close();
}

console.log("problems:", problems.length ? problems : "none");
await browser.close();
if (problems.length) process.exitCode = 1;
