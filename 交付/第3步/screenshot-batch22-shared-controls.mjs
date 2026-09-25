// 第 22 批截图：共享状态徽标、加入/退出、星标。
// 优先项目列表；没有项目时改看智能体列表；设计指南只读补全状态与成员操作。
// 不点击加入、退出或星标，不改变数据。
// 用法：node 交付/第3步/screenshot-batch22-shared-controls.mjs <输出目录>
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const outDir = process.argv[2];
await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/google-chrome" });
const problems = [];
const BASE = "http://127.0.0.1:3200";

async function openPage(lng, viewport, urlPathAndQuery) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const tag = `${lng}-${viewport.width}-${urlPathAndQuery}`;
  page.on("console", (m) => { if (m.type() === "error") problems.push(`${tag} console: ${m.text()}`); });
  page.on("pageerror", (e) => problems.push(`${tag} pageerror: ${e.message}`));
  page.on("response", (r) => {
    const url = r.url();
    if (r.status() < 400) return;
    // 设计指南里的占位附件和演示连接意图会自己打出 404/500，与本批组件无关。
    if (url.includes("/documents/plan")) return;
    if (url.includes("/api/attachments/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")) return;
    if (url.includes("/api/connection-intents/")) return;
    problems.push(`${tag} http ${r.status()} ${url}`);
  });
  const lngParam = lng === "zh" ? "lng=zh-CN" : "lng=en";
  const sep = urlPathAndQuery.includes("?") ? "&" : "?";
  await page.goto(`${BASE}${urlPathAndQuery}${sep}${lngParam}`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(800);
  return { ctx, page };
}

async function shot(page, name) {
  const lang = await page.evaluate(() => document.documentElement.lang);
  console.log(name, "lang=", lang);
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: false });
}

function expectLang(lng, htmlLang) {
  const wanted = lng === "zh" ? "zh-CN" : "en";
  if (htmlLang !== wanted) problems.push(`${lng}: html lang ${htmlLang} expected ${wanted}`);
}

for (const lng of ["en", "zh"]) {
  const projects = await openPage(lng, { width: 1440, height: 1100 }, "/ANC/projects");
  const htmlLang = await projects.page.evaluate(() => document.documentElement.lang);
  expectLang(lng, htmlLang);
  const body = await projects.page.evaluate(() => document.body.innerText);
  const empty = lng === "zh" ? "还没有项目。" : "No projects yet.";
  const noCompany = lng === "zh" ? "请选择公司以查看项目。" : "Select an organization to view projects.";
  const join = lng === "zh" ? "加入" : "Join";
  const leave = lng === "zh" ? "退出" : "Leave";
  console.log(`${lng} projects empty=${body.includes(empty)} noCompany=${body.includes(noCompany)} join=${body.includes(join)} leave=${body.includes(leave)}`);
  const projectButtons = await projects.page.locator("button").evaluateAll((els) =>
    els.map((el) => ({
      text: (el.textContent || "").trim(),
      aria: el.getAttribute("aria-label"),
    })),
  );
  const starButtons = projectButtons.filter((b) =>
    lng === "zh"
      ? (b.aria || "").includes("加星标") || (b.aria || "").includes("星标")
      : (b.aria || "").startsWith("Star ") || (b.aria || "").startsWith("Unstar "),
  );
  const memberButtons = projectButtons.filter((b) =>
    lng === "zh" ? b.text === "加入" || b.text === "退出" : b.text === "Join" || b.text === "Leave",
  );
  console.log(`${lng} projects member=${memberButtons.length} star=${starButtons.length}`);
  if (!body.includes(empty) && !body.includes(noCompany) && memberButtons.length === 0) {
    problems.push(`${lng} projects: expected join/leave or empty state`);
  }
  if (lng === "zh" && (body.includes("Join ") || body.includes("Leave "))) {
    problems.push("zh projects still shows English Join/Leave");
  }
  await shot(projects.page, `${lng}-desktop-projects`);
  await projects.ctx.close();

  const agents = await openPage(lng, { width: 1440, height: 1100 }, "/ANC/agents");
  const agentLang = await agents.page.evaluate(() => document.documentElement.lang);
  expectLang(lng, agentLang);
  const agentBody = await agents.page.evaluate(() => document.body.innerText);
  const agentButtons = await agents.page.locator("button").evaluateAll((els) =>
    els.map((el) => ({
      text: (el.textContent || "").trim(),
      aria: el.getAttribute("aria-label"),
    })),
  );
  const agentStars = agentButtons.filter((b) =>
    lng === "zh"
      ? (b.aria || "").includes("星标")
      : (b.aria || "").startsWith("Star ") || (b.aria || "").startsWith("Unstar "),
  );
  const agentMembers = agentButtons.filter((b) =>
    lng === "zh" ? b.text === "加入" || b.text === "退出" : b.text === "Join" || b.text === "Leave",
  );
  const statusHits = lng === "zh"
    ? ["空闲", "运行中", "已暂停", "错误"].filter((s) => agentBody.includes(s))
    : ["idle", "running", "paused", "error"].filter((s) => agentBody.includes(s));
  console.log(`${lng} agents member=${agentMembers.length} star=${agentStars.length} status=${statusHits.join(",") || "none"}`);
  console.log(`${lng} agents sample star`, agentStars.slice(0, 2));
  if (lng === "zh" && agentStars.some((b) => (b.aria || "").startsWith("Star ") || (b.aria || "").startsWith("Unstar "))) {
    problems.push("zh agents star aria still English");
  }
  if (agentMembers.length === 0 && agentStars.length === 0) {
    console.log(`${lng} agents data limitation: no membership/star controls`);
  }
  await shot(agents.page, `${lng}-desktop-agents`);
  await agents.ctx.close();

  const guide = await openPage(lng, { width: 1440, height: 1100 }, "/ANC/design-guide");
  const guideLang = await guide.page.evaluate(() => document.documentElement.lang);
  expectLang(lng, guideLang);
  const statusHeading = guide.page.getByText("Status System", { exact: true }).first();
  if (await statusHeading.count() === 0) {
    problems.push(`${lng} design guide: missing Status System`);
  } else {
    await statusHeading.scrollIntoViewIfNeeded();
    await guide.page.waitForTimeout(300);
    const near = await statusHeading.evaluate((el) => {
      const section = el.closest("section") ?? el.parentElement?.parentElement;
      return section ? section.innerText : "";
    });
    const zhStatuses = ["待办列表", "待办", "进行中", "审查中", "已完成", "已阻塞", "已取消", "空闲", "运行中"];
    const enStatuses = ["Backlog", "Todo", "In progress", "In review", "Done", "Blocked", "Cancelled"];
    const wanted = lng === "zh" ? zhStatuses : enStatuses;
    for (const label of wanted) {
      if (!near.includes(label)) problems.push(`${lng} design guide missing ${label}`);
    }
    if (lng === "zh" && near.includes("In review")) problems.push("zh design guide still shows In review");
    await shot(guide.page, `${lng}-desktop-design-guide-status`);
  }
  const membershipHeading = guide.page.getByText("Membership action", { exact: true }).first();
  if (await membershipHeading.count() === 0) {
    problems.push(`${lng} design guide: missing Membership action`);
  } else {
    await membershipHeading.scrollIntoViewIfNeeded();
    await guide.page.waitForTimeout(200);
    const memberText = await membershipHeading.evaluate((el) => {
      const section = el.closest("section") ?? el.parentElement?.parentElement;
      return section ? section.innerText : "";
    });
    const wantedMembers = lng === "zh" ? ["加入", "退出", "加入中…", "退出中…"] : ["Join", "Leave", "Joining...", "Leaving..."];
    for (const label of wantedMembers) {
      if (!memberText.includes(label)) problems.push(`${lng} design guide missing ${label}`);
    }
    // 已加入行在桌面端默认把操作藏到悬停后。只悬停，不点击。
    const joinedRow = guide.page.getByText("Joined resource", { exact: true }).first();
    const joiningRow = guide.page.getByText("Joining resource", { exact: true }).first();
    if (await joinedRow.count()) await joinedRow.hover();
    if (await joiningRow.count()) await joiningRow.hover();
    await guide.page.waitForTimeout(200);
    await shot(guide.page, `${lng}-desktop-design-guide-membership`);
  }
  await guide.ctx.close();
}

await browser.close();
if (problems.length) {
  console.log("problems:");
  for (const problem of problems) console.log(" -", problem);
  process.exit(1);
}
console.log("problems: none");
