const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({width: 1280, height: 2000});
  await page.goto('http://localhost:5500');
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({path: 'screenshot.png', fullPage: true});
  await browser.close();
})();
