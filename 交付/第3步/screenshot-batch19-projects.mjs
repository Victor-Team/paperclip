// 第 19 批截图：Projects 列表页与排序菜单展开态。
// 只浏览和切换排序菜单，不新增、加入、离开或收藏项目。
// 用法：node 交付/第3步/screenshot-batch19-projects.mjs <输出目录>
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const outDir = process.argv[2];
await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/google-chrome" });
const problems = [];
const BASE = "http://127.0.0.1:3200";
const PROJECTS = "/ANC/projects";

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
  const { ctx, page } = await openPage(lng, { width: 1440, height: 1100 }, PROJECTS);
  const htmlLang = await page.evaluate(() => document.documentElement.lang);
  const expectLang = lng === "zh" ? "zh-CN" : "en";
  console.log(`${lng} html lang=`, htmlLang);
  if (htmlLang !== expectLang) problems.push(`${lng}: html lang ${htmlLang} expected ${expectLang}`);

  const addProject = lng === "zh" ? "添加项目" : "Add Project";
  const sortTitle = lng === "zh" ? "排序" : "Sort";
  const sortName = lng === "zh" ? "排序：名称" : "Sort: Name";
  const myProjects = lng === "zh" ? "我的项目" : "My Projects";
  const otherProjects = lng === "zh" ? "其他项目" : "Other Projects";
  const empty = lng === "zh" ? "还没有项目。" : "No projects yet.";
  const noCompany = lng === "zh" ? "请选择公司以查看项目。" : "Select an organization to view projects.";
  const sortUpdated = lng === "zh" ? "已更新" : "Updated";
  const sortCreated = lng === "zh" ? "创建时间" : "Created";
  const sortTarget = lng === "zh" ? "目标日期" : "Target date";

  const body = await page.evaluate(() => document.body.innerText);
  console.log(`${lng} has addProject:`, body.includes(addProject));
  console.log(`${lng} has sortName:`, body.includes(sortName));
  console.log(`${lng} has myProjects:`, body.includes(myProjects));
  console.log(`${lng} has otherProjects:`, body.includes(otherProjects));
  console.log(`${lng} has empty:`, body.includes(empty));
  console.log(`${lng} has noCompany:`, body.includes(noCompany));
  if (lng === "zh") {
    if (body.includes("Add Project")) problems.push("zh page still shows English Add Project");
    if (body.includes("Sort: Name")) problems.push("zh page still shows English Sort: Name");
    if (body.includes("My Projects")) problems.push("zh page still shows English My Projects");
    if (body.includes("Other Projects")) problems.push("zh page still shows English Other Projects");
    if (body.includes("No projects yet.")) problems.push("zh page still shows English No projects yet.");
  }

  const hasList = body.includes(myProjects) || body.includes(otherProjects);
  const hasEmpty = body.includes(empty);
  const hasNoCompany = body.includes(noCompany);
  if (!body.includes(addProject) && !hasNoCompany) problems.push(`${lng}: missing Add Project`);
  if (!hasList && !hasEmpty && !hasNoCompany) {
    problems.push(`${lng}: missing list sections and empty state`);
  }
  if (hasList) {
    const projectCount = lng === "zh" ? "个项目" : "project";
    if (!body.includes(projectCount)) problems.push(`${lng}: missing project count interpolation`);
  }

  await shot(page, `${lng}-desktop-projects`);

  const sortButton = page.locator(`button[title="${sortTitle}"]`);
  if (await sortButton.count() === 0) {
    problems.push(`${lng}: missing sort button title=${sortTitle}`);
  } else {
    await sortButton.click();
    await page.waitForTimeout(400);
    const open = await page.evaluate(() => document.body.innerText);
    console.log(`${lng} menu has Updated:`, open.includes(sortUpdated));
    console.log(`${lng} menu has Created:`, open.includes(sortCreated));
    console.log(`${lng} menu has Target date:`, open.includes(sortTarget));
    if (!open.includes(sortUpdated)) problems.push(`${lng}: missing Updated in sort menu`);
    if (!open.includes(sortCreated)) problems.push(`${lng}: missing Created in sort menu`);
    if (!open.includes(sortTarget)) problems.push(`${lng}: missing Target date in sort menu`);
    if (lng === "zh" && open.includes("Target date")) {
      problems.push("zh sort menu still shows English Target date");
    }
    await shot(page, `${lng}-desktop-sort-menu`);
  }
  await ctx.close();
}

console.log("problems:", problems.length ? problems : "none");
await browser.close();
if (problems.length) process.exitCode = 1;
