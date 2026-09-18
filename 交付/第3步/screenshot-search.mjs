import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const outDir = process.argv[2];
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/google-chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on("console", (msg) => { if (msg.type() === "error") console.log("[console:error]", msg.text()); });
page.on("pageerror", (err) => console.log("[pageerror]", err.message));
page.on("response", (res) => { if (res.status() >= 400) console.log("[http]", res.status(), res.url()); });

await page.goto("http://127.0.0.1:3200/ANC/search?lng=zh-CN", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(1500);
console.log("URL after zh-CN load:", page.url());
await page.screenshot({ path: path.join(outDir, "01-search-zh-initial.png") });

await page.fill('input[aria-label]', "测试");
await page.waitForTimeout(1000);
await page.screenshot({ path: path.join(outDir, "02-search-zh-query.png") });

await page.goto("http://127.0.0.1:3200/ANC/search", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(1000);
console.log("URL after en load:", page.url());
await page.screenshot({ path: path.join(outDir, "03-search-en-control.png") });

await browser.close();
