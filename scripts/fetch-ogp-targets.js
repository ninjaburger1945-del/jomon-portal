const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const https = require('https');
const http = require('http');

const facilitiesPath = path.join(__dirname, '../app/data/facilities.json');
let data = JSON.parse(fs.readFileSync(facilitiesPath, 'utf-8'));

const targets = ['sannaimaruyama', 'togariishi', 'korekawa', 'jomon-museum'];
const targetFacilities = data.filter(f => targets.includes(f.id));

async function downloadImage(url, dest) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
            if (res.statusCode === 200) {
                const file = fs.createWriteStream(dest);
                res.pipe(file);
                file.on('finish', () => { file.close(); resolve(true); });
            } else if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                downloadImage(res.headers.location, dest).then(resolve).catch(reject);
            } else {
                resolve(false);
            }
        }).on('error', reject);
    });
}

(async () => {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const publicDir = path.join(__dirname, '../public/images/facilities');

    for (const facility of targetFacilities) {
        const page = await browser.newPage();
        try {
            console.log(`Checking OGP for ${facility.name} at ${facility.url}`);
            await page.goto(facility.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
            const ogImage = await page.$eval('meta[property="og:image"]', el => el.content).catch(() => null);

            if (ogImage) {
                console.log(`Found OGP: ${ogImage}`);

                let imageUrl = ogImage;
                if (imageUrl.startsWith('/')) {
                    const urlObj = new URL(facility.url);
                    imageUrl = `${urlObj.protocol}//${urlObj.host}${imageUrl}`;
                }

                const destPath = path.join(publicDir, `${facility.id}_ogp.jpg`);
                const success = await downloadImage(imageUrl, destPath);

                if (success) {
                    console.log(`✅ Downloaded OGP for ${facility.name}`);
                    facility.thumbnail = `/images/facilities/${facility.id}_ogp.jpg`;
                } else {
                    console.log(`❌ Failed to download OGP for ${facility.name}`);
                }
            } else {
                console.log(`⚠️ No OGP found for ${facility.name}`);
            }
        } catch (e) {
            console.error(`Error processing ${facility.name}: ${e.message}`);
        }
        await page.close();
    }

    await browser.close();
    fs.writeFileSync(facilitiesPath, JSON.stringify(data, null, 2));
    console.log('Finished OGP checking.');
})();
