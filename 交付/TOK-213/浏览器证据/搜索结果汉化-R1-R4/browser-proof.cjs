const { chromium } = require('/home/yuanjian/dev/ANC-zh-cn/node_modules/@playwright/test');
const fs = require('fs');
const path = require('path');
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:'/usr/bin/google-chrome'});
  const out=[];
  for (const [name,width,height,lng] of [
    ['desktop-zh',1366,768,'zh-CN'],['narrow-zh',390,844,'zh-CN'],
    ['desktop-en',1366,768,'en'],['narrow-en',390,844,'en']
  ]) {
    const page=await browser.newPage({viewport:{width,height}});
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    const response=await page.goto(`http://127.0.0.1:3200/ANC/search?lng=${lng}&q=test&status=todo`,{waitUntil:'networkidle'});
    await page.waitForSelector('[data-result-type=issue]',{timeout:15000});
    const filterBar=await page.locator('[data-testid=search-filter-bar]').allTextContents();
    const chips=await page.locator('[data-testid=search-filter-chips]').allTextContents();
    const results=await page.locator('[data-result-type=issue]').allTextContents();
    const sourceLabels=await page.locator('[data-result-type=issue] span.uppercase').allTextContents();
    const scope=await page.locator('select[aria-label] option').allTextContents();
    await page.screenshot({path:path.join(__dirname,`${name}-results.png`),fullPage:true});
    let expanded='';
    if (width>768) {
      const sort=page.locator('[data-testid=search-filter-bar] button').last();
      await sort.click();
      expanded=await page.locator('[role=menu]').allTextContents().then(a=>a.join(' | '));
    } else {
      const trigger=page.getByRole('button',{name:lng==='zh-CN'?/筛选条件/:/Filters/}).first();
      await trigger.click();
      expanded=await page.locator('[data-testid=search-filter-sheet]').allTextContents().then(a=>a.join(' | '));
    }
    await page.screenshot({path:path.join(__dirname,`${name}-expanded.png`),fullPage:true});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    const passed=response.status()===200 && !overflow && errors.length===0 && results.length>0
      && (lng==='zh-CN'
        ? chips.join('').includes('状态：待办') && sourceLabels.includes('描述')
          && expanded.includes('相关性') && expanded.includes('最近更新')
          && (width>768 ? filterBar.join('').includes('相关性') : scope[0]?.startsWith('全部'))
        : chips.join('').includes('Status: Todo') && sourceLabels.includes('Description')
          && expanded.includes('Relevance') && expanded.includes('Recently updated')
          && (width>768 ? filterBar.join('').includes('Relevance') : scope[0]?.startsWith('All')));
    out.push({name,status:response.status(),url:page.url(),filterBar,chips,results,sourceLabels,scope,expanded,overflow,errors,passed});
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(__dirname,'browser-result.json'),JSON.stringify(out,null,2)+'\n');
  console.log(JSON.stringify(out,null,2));
  if(out.some(row=>!row.passed)) process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});
