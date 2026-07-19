const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  await page.goto('https://hi-chat-ten.vercel.app/', { waitUntil: 'networkidle2' });
  const manifest = await page.evaluate(() => {
    return document.querySelector('link[rel="manifest"]').href;
  });
  console.log('Manifest:', manifest);
  await browser.close();
})();
