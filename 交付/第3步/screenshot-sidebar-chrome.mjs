// 第 6 批 侧栏收尾截图：账号菜单、公司菜单（含编辑排序态）、跳到主内容链接、分区折叠按钮、移动 390 底栏与抽屉。
// 用法：node screenshot-sidebar-chrome.mjs <输出目录> [main|prod]
//   main = 默认设置（streamlined 布局，走 Sidebar / SidebarAccountMenu / SidebarCompanyMenu / Layout）
//   prod = 关闭 streamlined（走 *.production 孪生）
// 每张图输出：<html lang>、当前可见弹层文字、页面里全部 aria-label，供核对哪些串仍是英文。
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const outDir = process.argv[2];
const group = process.argv[3] ?? "main";
await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/google-chrome" });
const problems = [];
const prefix = group === "main" ? "" : "prod-";

async function openPage(lng, viewport) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const tag = `${group}-${lng}-${viewport.width}`;
  page.on("console", (m) => { if (m.type() === "error") problems.push(`${tag} console: ${m.text()}`); });
  page.on("pageerror", (e) => problems.push(`${tag} pageerror: ${e.message}`));
  page.on("response", (r) => { if (r.status() >= 400) problems.push(`${tag} http ${r.status()} ${r.url()}`); });
  await page.goto(`http://127.0.0.1:3200/ANC/dashboard${lng === "zh" ? "?lng=zh-CN" : ""}`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);
  return { ctx, page };
}

async function shot(page, name, extra) {
  const lang = await page.evaluate(() => document.documentElement.lang);
  const labels = await page.evaluate(() => [...new Set([...document.querySelectorAll("[aria-label]")].map((e) => e.getAttribute("aria-label")))]);
  const popup = await page.evaluate(() =>
    [...document.querySelectorAll('[role="menu"], [data-radix-popper-content-wrapper]')].map((e) => e.innerText.replace(/\n+/g, " | ")));
  console.log(name, "lang=", lang, "aria=", JSON.stringify(labels), "popup=", JSON.stringify(popup), extra ?? "");
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
}

for (const lng of ["en", "zh"]) {
  // ---- 桌面 1440×900
  {
    const { ctx, page } = await openPage(lng, { width: 1440, height: 900 });
    // 跳到主内容链接：sr-only 链接获得焦点才可见；直接 focus() 它（首次 Tab 会落在别处，不可靠）
    await page.evaluate(() => document.querySelector('a[href="#main-content"]')?.focus());
    await page.waitForTimeout(300);
    await shot(page, `${prefix}${lng}-desktop-skip-link`, `skipFocused=${await page.evaluate(() => document.activeElement?.textContent?.trim())}`);
    await page.evaluate(() => document.activeElement?.blur()); // 聚焦态的跳转链接是 fixed 浮层，会盖住公司菜单触发器
    // 分区折叠按钮：悬停分区标题，读取 aria-label
    await page.mouse.move(60, 300);
    await page.waitForTimeout(300);
    await shot(page, `${prefix}${lng}-desktop-sidebar`);
    // 公司菜单
    await page.locator("button[aria-label]").evaluateAll((els) => {
      const el = els.find((e) => /switcher|切换器/.test(e.getAttribute("aria-label")));
      if (el) el.setAttribute("data-shot-target", "company");
    });
    await page.locator('[data-shot-target="company"]').click();
    await page.waitForTimeout(600);
    await shot(page, `${prefix}${lng}-desktop-company-menu`);
    const editBtn = page.getByRole("menu").getByRole("button", { name: /^(Edit|编辑)$/ });
    if (await editBtn.count()) {
      await editBtn.click();
      await page.waitForTimeout(400);
      await shot(page, `${prefix}${lng}-desktop-company-menu-edit`);
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    // 账号菜单
    await page.locator("button[aria-label]").evaluateAll((els) => {
      const el = els.find((e) => /Open account menu|打开账号菜单/.test(e.getAttribute("aria-label")));
      if (el) el.setAttribute("data-shot-target", "account");
    });
    await page.locator('[data-shot-target="account"]').click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(outDir, `${prefix}${lng}-desktop-account-menu.png`) });
    console.log(`${prefix}${lng}-desktop-account-menu popover=`, JSON.stringify(await page.evaluate(() => [...document.querySelectorAll("[data-radix-popper-content-wrapper]")].map((e) => e.innerText.replace(/\n+/g, " | ")))));
    await ctx.close();
  }
  // ---- 移动 390×844：底栏 + 抽屉里的公司菜单／账号菜单
  {
    const { ctx, page } = await openPage(lng, { width: 390, height: 844 });
    await shot(page, `${prefix}${lng}-mobile-bottom-nav`, `nav=${JSON.stringify(await page.evaluate(() => [...document.querySelectorAll("nav[aria-label]")].map((n) => n.getAttribute("aria-label") + ": " + n.innerText.replace(/\n+/g, " | "))))}`);
    await page.locator('button[aria-label="Open sidebar"], button[aria-label="打开侧边栏"]').first().click();
    await page.waitForTimeout(700);
    await shot(page, `${prefix}${lng}-mobile-drawer`);
    await page.locator("button[aria-label]").evaluateAll((els) => {
      const el = els.find((e) => /switcher|切换器/.test(e.getAttribute("aria-label")));
      if (el) el.setAttribute("data-shot-target", "company");
    });
    if (await page.locator('[data-shot-target="company"]').count()) {
      await page.locator('[data-shot-target="company"]').click();
      await page.waitForTimeout(600);
      await shot(page, `${prefix}${lng}-mobile-company-menu`);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }
    await page.locator("button[aria-label]").evaluateAll((els) => {
      const el = els.find((e) => /Open account menu|打开账号菜单/.test(e.getAttribute("aria-label")));
      if (el) el.setAttribute("data-shot-target", "account");
    });
    if (await page.locator('[data-shot-target="account"]').count()) {
      await page.locator('[data-shot-target="account"]').click();
      await page.waitForTimeout(600);
      await shot(page, `${prefix}${lng}-mobile-account-menu`);
    }
    await ctx.close();
  }
}
await browser.close();
console.log("problems:", problems.length ? problems : "none");
