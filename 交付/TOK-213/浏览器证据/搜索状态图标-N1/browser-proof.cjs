const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const outputDir = __dirname;
const baseUrl = 'http://127.0.0.1:3200';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome' });
  const results = [];
  for (const [name, width, height, language, expectedLabel] of [
    ['desktop-en', 1366, 768, 'en', 'Idle'],
    ['desktop-zh', 1366, 768, 'zh-CN', '空闲'],
    ['narrow-en', 390, 844, 'en', 'Idle'],
    ['narrow-zh', 390, 844, 'zh-CN', '空闲'],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    let intercepted = 0;
    await page.route('**/api/companies/*/search?*', async (route) => {
      const response = await route.fetch();
      const payload = await response.json();
      const issue = payload.results?.find((result) => result.type === 'issue')?.issue;
      if (issue) {
        issue.status = 'in_review';
        issue.externalConversationState = 'waiting';
        intercepted += 1;
      }
      await route.fulfill({ response, json: payload });
    });
    const response = await page.goto(`${baseUrl}/ANC/search?lng=${language}&q=test`, { waitUntil: 'networkidle' });
    const icon = page.locator('[data-result-type="issue"] svg[role="img"]').first();
    await icon.waitFor();
    const label = await icon.getAttribute('aria-label');
    const title = await icon.locator('title').textContent();
    const glyphClass = await icon.getAttribute('class');
    const style = await icon.getAttribute('style');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    await page.screenshot({ path: path.join(outputDir, `${name}.png`), fullPage: true });
    const passed = response.status() === 200 && intercepted > 0 && label === expectedLabel && title === expectedLabel
      && glyphClass.includes('lucide-circle') && !glyphClass.includes('lucide-circle-dot')
      && !overflow && errors.length === 0;
    results.push({ name, url: page.url(), httpStatus: response.status(), intercepted, label, title, glyphClass, style, overflow, errors, passed });
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(outputDir, 'browser-result.json'), `${JSON.stringify(results, null, 2)}\n`);
  console.log(JSON.stringify(results, null, 2));
  if (results.some((result) => !result.passed)) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exitCode = 1; });
