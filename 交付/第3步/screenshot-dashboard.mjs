// 第 3 批 Dashboard.tsx 截图：默认英文 + ?lng=zh-CN，桌面 1440×900 与移动 390×844 两套断点。
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const outDir = process.argv[2];
const state = process.argv[3] ?? "state"; // 数据状态标签，进文件名，如 all-paused / normal
await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/google-chrome" });
const problems = [];

const shots = [
  [`01-dashboard-${state}-en-desktop`, "", { width: 1440, height: 900 }],
  [`02-dashboard-${state}-zh-desktop`, "?lng=zh-CN", { width: 1440, height: 900 }],
  [`03-dashboard-${state}-en-mobile`, "", { width: 390, height: 844 }],
  [`04-dashboard-${state}-zh-mobile`, "?lng=zh-CN", { width: 390, height: 844 }],
];
for (const [name, query, viewport] of shots) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") problems.push(`${name} console: ${m.text()}`); });
  page.on("pageerror", (e) => problems.push(`${name} pageerror: ${e.message}`));
  page.on("response", (r) => { if (r.status() >= 400) problems.push(`${name} http ${r.status()} ${r.url()}`); });
  await page.goto(`http://127.0.0.1:3200/ANC/dashboard${query}`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);
  // 隔离实例里公司没有智能体，首页会自动弹出入门向导（不属于 Dashboard.tsx），按 Esc 关掉再截。
  if (await page.getByText(/Create your first agent|创建您的第一个智能体/).count()) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(800);
  }
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
  console.log(name, page.url());
  await ctx.close();
}
await browser.close();
console.log("problems:", problems.length ? problems : "none");
