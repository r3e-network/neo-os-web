const { chromium } = require('@playwright/test');

(async () => {
    try {
        console.log('Launching browser...');
        const browser = await chromium.launch();
        console.log('Browser launched. Creating page...');
        const page = await browser.newPage();
        await page.setContent('<div style="width:100px;height:100px;background:red;">Test</div>');
        console.log('Taking screenshot...');
        await page.screenshot({ path: 'test_pw.png' });
        await browser.close();
        console.log('Success!');
    } catch (e) {
        console.error('Error:', e);
    }
})();
