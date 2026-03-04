const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=ja-JP']
    });

    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7' });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const urls = [
        'https://irie-takasago.net/museum/', // irie-takasago
        'http://satohama-jomon.jp/', // satohama
        'https://www.vill.hara.lg.jp/docs/1684.html', // aku (was hara.lg.jp, let's try vill.hara)
        'https://www.city.ichikawa.lg.jp/edu09/1531000004.html', // ubayama (from my previous search)
        'https://www.city.ichikawa.lg.jp/edu04/1111000002.html' // soyata (from my previous search)
    ];

    for (const u of urls) {
        try {
            console.log(`\nTesting ${u} ...`);
            const res = await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 15000 });
            console.log(`Status: ${res.status()}`);
            const title = await page.title();
            console.log(`Title: ${title}`);
        } catch (e) {
            console.log(`Error: ${e.message}`);
        }
    }

    await browser.close();
})();
