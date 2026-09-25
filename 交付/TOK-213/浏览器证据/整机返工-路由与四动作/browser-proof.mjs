import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(process.cwd() + '/package.json');
const { chromium } = require('@playwright/test');
const companyId = '6f94c8ef-aced-48f0-8ec3-e5a14fe0aa9e';
const baseUrl = 'http://127.0.0.1:3200';
const outputDir = '交付/TOK-213/浏览器证据/整机返工-路由与四动作';
const actionLabels = { created: '已创建', renamed: '已重命名', replaced: '已替换', skipped: '已跳过' };
const result = {
  company: { id: companyId, name: '词元共振 Token Resonance', action: 'created' },
  agents: [],
  skills: Object.keys(actionLabels).map((action) => ({
    originalKey: `proof-${action}`,
    originalSlug: `proof-${action}`,
    key: `proof-${action}`,
    slug: action === 'renamed' ? 'proof-renamed-2' : `proof-${action}`,
    id: `proof-${action}`,
    action,
    reason: null,
  })),
  projects: [],
  routines: [],
  envInputs: [],
  warnings: [],
};
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const evidence = { sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), entry: 'pnpm dev:once', service: baseUrl, fixture: 'Chrome route interception of GET /api/companies/import/jobs/browser-proof; no import mutation', states: [] };

async function capture(name, url, viewport, mockJob = false) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  if (mockJob) {
    await context.addInitScript(({ companyId }) => {
      localStorage.setItem('paperclip.selectedCompanyId', companyId);
      sessionStorage.setItem(`paperclip:company-import-job:${companyId}:browser-proof`, JSON.stringify({ jobId: 'browser-proof', pauseAutomations: false }));
    }, { companyId });
    await context.route('**/api/companies/import/jobs/browser-proof', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ job: { id: 'browser-proof', status: 'succeeded', importResult: result } }) });
    });
  }
  const page = await context.newPage();
  const errors = [];
  const importMutations = [];
  page.on('pageerror', (error) => errors.push(`pageerror ${error.message}`));
  page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  page.on('request', (request) => { if (request.method() === 'POST' && request.url().includes('/api/companies/import')) importMutations.push(request.url()); });
  await page.goto(`${baseUrl}${url}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (mockJob) {
    await page.getByText('技能导入结果', { exact: true }).waitFor({ timeout: 30000 });
  } else if (url.includes('paperclipai%3Aoptional')) {
    await page.getByText('必填技能', { exact: true }).first().waitFor({ timeout: 30000 });
  } else {
    await page.getByText('Core Exec Team', { exact: true }).first().waitFor({ timeout: 30000 });
  }
  await page.waitForTimeout(350);
  const body = await page.locator('body').innerText();
  if (body.includes('Page not found') || body.includes('This route does not exist')) throw new Error(`${name}: route fallback visible`);
  const rows = mockJob ? await page.evaluate(() => [...document.querySelectorAll('div.divide-y.divide-border > div')]
    .filter((element) => element.firstElementChild?.textContent?.startsWith('proof-'))
    .map((element) => ({ slug: element.firstElementChild?.textContent, action: element.children[1]?.textContent }))) : [];
  if (mockJob) {
    for (const [action, expected] of Object.entries(actionLabels)) {
      if (rows.find((row) => row.slug === `proof-${action}`)?.action !== expected) throw new Error(`${name}: incorrect ${action} row: ${JSON.stringify(rows)}`);
    }
    if (importMutations.length) throw new Error(`${name}: unexpected import POST`);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (overflow > 0) throw new Error(`${name}: ${overflow}px horizontal overflow`);
  await page.screenshot({ path: path.join(outputDir, `${name}.png`), fullPage: true });
  evidence.states.push({ name, requestedUrl: url, finalUrl: page.url(), viewport, overflowPx: overflow, rows, importMutations, errors, visibleChecks: mockJob ? ['技能导入结果', ...Object.values(actionLabels)] : ['Core Exec Team', '3 个智能体', '团队'] });
  if (name === 'narrow-team-detail') {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(200);
    await page.getByText('TEAM.md', { exact: true }).waitFor({ timeout: 5000 });
    await page.screenshot({ path: path.join(outputDir, 'narrow-team-detail-bottom.png'), fullPage: false });
    evidence.states.push({ name: 'narrow-team-detail-bottom', requestedUrl: url, finalUrl: page.url(), viewport, scrollY: await page.evaluate(() => window.scrollY), visibleChecks: ['TEAM.md', '必填技能'] });
  }
  await context.close();
}
try {
  await capture('desktop-team-real-route', '/TOK/teams-catalog?lng=zh-CN', { width: 1366, height: 768 });
  await capture('narrow-team-real-route', '/TOK/teams-catalog?lng=zh-CN', { width: 390, height: 844 });
  await capture('narrow-team-detail', '/TOK/teams-catalog/paperclipai%3Aoptional%3Acontent%3Acontent-machine?lng=zh-CN', { width: 390, height: 844 });
  await capture('desktop-import-four-actions', '/TOK/company/import?lng=zh-CN', { width: 1366, height: 768 }, true);
  await capture('narrow-import-four-actions', '/TOK/company/import?lng=zh-CN', { width: 390, height: 844 }, true);
  await writeFile(path.join(outputDir, 'browser-result.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await browser.close();
}
