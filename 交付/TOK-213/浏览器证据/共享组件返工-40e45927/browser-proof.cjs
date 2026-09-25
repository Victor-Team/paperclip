const { chromium } = require('/home/yuanjian/dev/ANC-zh-cn/node_modules/@playwright/test');
const fs = require('fs');
const path = require('path');
const out = __dirname;
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:"/usr/bin/google-chrome"});
  const results=[];
  for (const [name,width,height,lng] of [
    ['desktop-zh',1366,768,'zh-CN'],['narrow-zh',390,844,'zh-CN'],
    ['desktop-en',1366,768,'en'],['narrow-en',390,844,'en']
  ]) {
    const page=await browser.newPage({viewport:{width,height}});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const url=`http://127.0.0.1:3200/ANC/search?lng=${lng}&q=test`;
    const response=await page.goto(url,{waitUntil:'networkidle'});
    await page.waitForSelector('main, [role=main]', {timeout:15000}).catch(()=>{});
    await page.waitForTimeout(700);
    const select=page.locator('select[aria-label]');
    const options=await select.count() ? await select.locator('option').allTextContents() : [];
    await page.screenshot({path:path.join(out,`${name}-search.png`),fullPage:true});
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(200);
    const headings=await page.locator('[cmdk-group-heading]').allTextContents();
    const titles=await page.locator('[data-slot=dialog-title], [data-slot=dialog-description]').allTextContents();
    await page.screenshot({path:path.join(out,`${name}-command.png`),fullPage:true});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    const expected = lng === 'zh-CN'
      ? { title: '命令面板', description: '搜索要执行的命令…', heading: '快捷筛选', firstOption: '全部 (0)' }
      : { title: 'Command Palette', description: 'Search for a command to run...', heading: 'Quick filters', firstOption: 'All (0)' };
    const passed = response.status() === 200 && !overflow && errors.length === 0
      && titles.includes(expected.title) && titles.includes(expected.description)
      && headings.includes(expected.heading)
      && (width > 768 || options[0] === expected.firstOption);
    results.push({name,status:response.status(),url:page.url(),options,headings,titles,overflow,errors,passed});
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(out,'browser-result.json'),JSON.stringify(results,null,2)+'\n');
  console.log(JSON.stringify(results,null,2));
  if (results.some((result) => !result.passed)) process.exitCode = 1;
})().catch(e=>{console.error(e);process.exit(1)});
