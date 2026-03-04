const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const targets = [
    { id: 'sannaimaruyama', page: 'https://commons.wikimedia.org/wiki/File:Sannai-Maruyama_site04_2816.jpg' },
    { id: 'togariishi', page: 'https://commons.wikimedia.org/wiki/File:Jomon_Venus.JPG' },
    { id: 'korekawa', page: 'https://commons.wikimedia.org/wiki/File:Gassho_Dogu_Hachinohe_Aomori.JPG' },
    { id: 'jomon-museum', page: 'https://commons.wikimedia.org/wiki/File:Wakasa_Mikata_Jomon_Museum01bs3200.jpg' }
];

const destDir = path.join(__dirname, '../public/images/facilities');
const facilitiesPath = path.join(__dirname, '../app/data/facilities.json');
const data = JSON.parse(fs.readFileSync(facilitiesPath, 'utf-8'));

(async () => {
    console.log('--- Fetching Original Images from Wikimedia Commons ---');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    for (const target of targets) {
        try {
            console.log(`Navigating to ${target.page}...`);
            await page.goto(target.page, { waitUntil: 'domcontentloaded' });

            // The link to the original file is usually an 'a' tag with class 'internal'
            const originalUrl = await page.evaluate(() => {
                const a = document.querySelector('.fullMedia a.internal');
                return a ? a.href : null;
            });

            if (!originalUrl) {
                console.log(`  -> Could not find original file link for ${target.id}`);
                continue;
            }

            console.log(`  -> Original URL: ${originalUrl}`);

            const ext = path.extname(new URL(originalUrl).pathname) || '.jpg';
            const dest = path.join(destDir, `${target.id}${ext}`);

            // To bypass 403, we navigate directly to the image url with Puppeteer and save the buffer
            const viewSource = await page.goto(originalUrl);
            const buffer = await viewSource.buffer();

            fs.writeFileSync(dest, buffer);
            console.log(`  -> Saved to: ${dest} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);

            const facility = data.find(f => f.id === target.id);
            if (facility) {
                facility.thumbnail = `/images/facilities/${target.id}${ext}`;
                console.log(`  -> Updated facilities.json thumbnail to: ${facility.thumbnail}`);
            }
        } catch (e) {
            console.log(`Error processing ${target.id}: ${e.message}`);
        }
    }

    await browser.close();

    fs.writeFileSync(facilitiesPath, JSON.stringify(data, null, 2));
    console.log('Wikimedia Commons image fetch complete.');
})();
