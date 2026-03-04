const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const facilitiesPath = './app/data/facilities.json';
const data = JSON.parse(fs.readFileSync(facilitiesPath, 'utf-8'));
const publicDir = path.join(__dirname, '../public');

async function testExternalUrl(page, url) {
    try {
        const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        const status = res.status();
        if (status >= 400) return `HTTP ${status}`;

        // Check for obvious 404 page content
        const title = await page.title();
        if (title.includes('404') || title.includes('Not Found') || title.includes('見つかりません')) {
            return `404 content in title: ${title}`;
        }
        return null; // OK
    } catch (e) {
        return `Error: ${e.message}`;
    }
}

(async () => {
    console.log('--- FINAL 100% VALIDATION ---');
    let hasError = false;

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');

    for (const facility of data) {
        // 1. Check Image
        let imgOk = false;
        if (facility.thumbnail) {
            if (facility.thumbnail.startsWith('http')) {
                const imgCheck = await testExternalUrl(page, facility.thumbnail);
                if (!imgCheck) imgOk = true;
                else console.log(`[ERR IMG] ${facility.name} : ${imgCheck}`);
            } else {
                const localPath = path.join(publicDir, facility.thumbnail);
                if (fs.existsSync(localPath)) {
                    imgOk = true;
                } else {
                    console.log(`[ERR IMG] ${facility.name} : Local file missing -> ${facility.thumbnail}`);
                }
            }
        } else {
            console.log(`[ERR IMG] ${facility.name} : No thumbnail specified.`);
        }

        if (!imgOk) hasError = true;

        // 2. Check Facility Link
        if (facility.url && facility.url !== '#') {
            const linkCheck = await testExternalUrl(page, facility.url);
            if (linkCheck) {
                console.log(`[ERR LINK] ${facility.name} : ${linkCheck} -> ${facility.url}`);
                hasError = true;
            }
        } else {
            console.log(`[ERR LINK] ${facility.name} : No valid link specified.`);
            hasError = true;
        }
    }

    await browser.close();

    if (hasError) {
        console.log('Final Validation FAILED. Please fix the errors before deploying.');
        process.exit(1);
    } else {
        console.log('Final Validation PASSED (100% OK). Ready for deploy.');
        process.exit(0);
    }
})();
