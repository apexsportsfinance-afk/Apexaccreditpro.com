const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  try {
    await page.goto('http://localhost:5180/admin/events', { waitUntil: 'networkidle2', timeout: 15000 });
  } catch (e) {
    console.log('Navigation timeout or error:', e.message);
  }
  await new Promise(r => setTimeout(r, 5000));
  await browser.close();
})();
