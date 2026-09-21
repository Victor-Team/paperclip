// 第 21 批截图：产物页、分组菜单/类型筛选、单卡或堆栈卡。
// 只搜索、筛选、切换分组和打开堆栈列表；不下载文件、不打开外部标签、不改数据。
// 用法：node 交付/第3步/screenshot-batch21-artifacts.mjs <输出目录>
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const outDir = process.argv[2];
await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/google-chrome" });
const problems = [];
const BASE = "http://127.0.0.1:3200";
const ARTIFACTS = "/ANC/artifacts";

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
  const { ctx, page } = await openPage(lng, { width: 1440, height: 1100 }, ARTIFACTS);
  const htmlLang = await page.evaluate(() => document.documentElement.lang);
  const expectLang = lng === "zh" ? "zh-CN" : "en";
  console.log(`${lng} html lang=`, htmlLang);
  if (htmlLang !== expectLang) problems.push(`${lng}: html lang ${htmlLang} expected ${expectLang}`);

  const search = lng === "zh" ? "搜索产物" : "Search artifacts";
  const groupBy = lng === "zh" ? "分组依据" : "Group by";
  const none = lng === "zh" ? "无" : "None";
  const task = lng === "zh" ? "任务" : "Task";
  const parentTask = lng === "zh" ? "父任务" : "Parent task";
  const all = lng === "zh" ? "全部" : "All";
  const images = lng === "zh" ? "图片" : "Images";
  const videos = lng === "zh" ? "视频" : "Videos";
  const documents = lng === "zh" ? "文档" : "Documents";
  const text = lng === "zh" ? "文本" : "Text";
  const files = lng === "zh" ? "文件" : "Files";
  const emptyStacks = lng === "zh" ? "还没有产物堆栈。" : "No artifact stacks yet.";
  const emptyAll = lng === "zh" ? "还没有产物。" : "No artifacts yet.";
  const noCompany = lng === "zh" ? "请选择一家公司以查看产物。" : "Select an organization to view artifacts.";
  const lastEdited = lng === "zh" ? "最后编辑于" : "Last edited ";
  const updated = lng === "zh" ? "已更新" : "Updated ";
  const artifactCount = lng === "zh" ? "个产物" : "artifact";

  const body = await page.evaluate(() => document.body.innerText);
  console.log(`${lng} has search:`, body.includes(search));
  console.log(`${lng} has all:`, body.includes(all));
  console.log(`${lng} has images:`, body.includes(images));
  console.log(`${lng} has emptyStacks:`, body.includes(emptyStacks));
  console.log(`${lng} has emptyAll:`, body.includes(emptyAll));
  console.log(`${lng} has noCompany:`, body.includes(noCompany));
  console.log(`${lng} has lastEdited:`, body.includes(lastEdited));
  console.log(`${lng} has updated:`, body.includes(updated));
  console.log(`${lng} has artifactCount:`, body.includes(artifactCount));
  if (lng === "zh") {
    if (body.includes("Search artifacts")) problems.push("zh page still shows English Search artifacts");
    if (body.includes("Group by")) problems.push("zh page still shows English Group by");
    if (body.includes("No artifact stacks yet.")) problems.push("zh page still shows English empty stacks");
    if (body.includes("Last edited ")) problems.push("zh page still shows English Last edited");
  }

  const searchInput = page.locator(`input[aria-label="${search}"]`);
  if (await searchInput.count() === 0 && !body.includes(noCompany)) {
    problems.push(`${lng}: missing search aria-label ${search}`);
  }
  for (const label of [all, images, videos, documents, text, files]) {
    if (!body.includes(label) && !body.includes(noCompany)) {
      problems.push(`${lng}: missing type filter ${label}`);
    }
  }

  await shot(page, `${lng}-desktop-artifacts`);

  const groupControl = page.locator('[data-testid="artifact-group-control"]');
  if (await groupControl.count() === 0) {
    if (!body.includes(noCompany)) problems.push(`${lng}: missing group control`);
  } else {
    await groupControl.click();
    await page.waitForTimeout(400);
    const open = await page.evaluate(() => document.body.innerText);
    console.log(`${lng} menu has groupBy:`, open.includes(groupBy));
    console.log(`${lng} menu has none:`, open.includes(none));
    console.log(`${lng} menu has task:`, open.includes(task));
    console.log(`${lng} menu has parentTask:`, open.includes(parentTask));
    if (!open.includes(groupBy)) problems.push(`${lng}: missing Group by in menu`);
    if (!open.includes(none)) problems.push(`${lng}: missing None in menu`);
    if (!open.includes(task)) problems.push(`${lng}: missing Task in menu`);
    if (!open.includes(parentTask)) problems.push(`${lng}: missing Parent task in menu`);
    if (lng === "zh" && open.includes("Parent task")) {
      problems.push("zh menu still shows English Parent task");
    }
    await shot(page, `${lng}-desktop-group-menu`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  }

  const groupCard = page.locator('[data-testid="artifact-group-card"]').first();
  const artifactCard = page.locator('[data-testid="artifact-card"]').first();
  if (await groupCard.count() > 0) {
    const cardText = await groupCard.innerText();
    console.log(`${lng} group card text:`, cardText.slice(0, 200));
    if (lng === "zh" && cardText.includes(" artifacts")) {
      problems.push("zh group card still shows English artifacts count");
    }
    await groupCard.scrollIntoViewIfNeeded();
    await shot(page, `${lng}-desktop-group-card`);
    await groupCard.click();
    await page.waitForTimeout(800);
    const stackBody = await page.evaluate(() => document.body.innerText);
    const allStacks = lng === "zh" ? "全部堆栈" : "All stacks";
    console.log(`${lng} has allStacks:`, stackBody.includes(allStacks));
    if (!stackBody.includes(allStacks)) problems.push(`${lng}: missing All stacks after opening stack`);
    await shot(page, `${lng}-desktop-stack`);
  } else if (await artifactCard.count() > 0) {
    const cardText = await artifactCard.innerText();
    console.log(`${lng} artifact card text:`, cardText.slice(0, 200));
    if (lng === "zh" && cardText.includes("Last edited")) {
      problems.push("zh artifact card still shows English Last edited");
    }
    await artifactCard.scrollIntoViewIfNeeded();
    await shot(page, `${lng}-desktop-artifact-card`);
  } else {
    console.log(`${lng} data limitation: no artifact/group cards on isolation instance`);
    const noneUrl = `${ARTIFACTS}?groupBy=none`;
    await ctx.close();
    const ungrouped = await openPage(lng, { width: 1440, height: 1100 }, noneUrl);
    const ungroupedBody = await ungrouped.page.evaluate(() => document.body.innerText);
    console.log(`${lng} has emptyAll:`, ungroupedBody.includes(emptyAll));
    if (!ungroupedBody.includes(emptyAll) && !ungroupedBody.includes(noCompany)) {
      problems.push(`${lng}: missing ungrouped empty state`);
    }
    if (lng === "zh" && ungroupedBody.includes("No artifacts yet.")) {
      problems.push("zh ungrouped empty still shows English");
    }
    await shot(ungrouped.page, `${lng}-desktop-empty-ungrouped`);
    await ungrouped.ctx.close();
    continue;
  }

  await ctx.close();
}

console.log("problems:", problems.length ? problems : "none");
await browser.close();
if (problems.length) process.exitCode = 1;
