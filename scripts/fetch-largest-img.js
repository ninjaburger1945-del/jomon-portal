const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const targets = [
    { id: 'sannaimaruyama', query: 'https://ja.wikipedia.org/wiki/%E4%B8%89%E5%86%85%E4%B8%B8%E5%B1%B1%E9%81%BA%E8%B7%A1' },
    { id: 'togariishi', query: 'https://ja.wikipedia.org/wiki/%E7%B8%84%E6%96%87%E3%81%AE%E3%83%93%E3%83%BC%E3%83%8A%E3%82%B9' },
    { id: 'korekawa', query: 'https://ja.wikipedia.org/wiki/%E5%90%88%E6%8E%8C%E5%9C%9F%E5%81%B6' },
    { id: 'jomon-museum', query: 'https://ja.wikipedia.org/wiki/%E8%8B%A5%E7%8B%AD%E4%B8%89%E6%96%B9%E7%B8%84%E6%96%87%E5%8D%9A%E7%89%A9%E9%A4%A8' }
];

const destDir = path.join(__dirname, '../public/images/facilities');
const facilitiesPath = path.join(__dirname, '../app/data/facilities.json');
const data = JSON.parse(fs.readFileSync(facilitiesPath, 'utf-8'));

(async () => {
    console.log('--- Fetching Largest Image from Wikipedia ---');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    for (const target of targets) {
        try {
            console.log(`Navigating to ${target.query}...`);
            await page.goto(target.query, { waitUntil: 'networkidle2' });

            // Get the largest image on the page
            const largestImgSrc = await page.evaluate(() => {
                const imgs = Array.from(document.querySelectorAll('img')).filter(img =>
                    img.src.includes('upload.wikimedia.org') &&
                    !img.src.includes('Map_symbol') &&
                    !img.src.includes('Ambox') &&
                    !img.src.includes('Information') &&
                    !img.src.includes('.svg')
                );
                imgs.sort((a, b) => (b.width * b.height) - (a.width * a.height));
                return imgs.length > 0 ? imgs[0].src : null;
            });

            if (!largestImgSrc) {
                console.log(`  -> No image found for ${target.id}`);
                continue;
            }

            console.log(`  -> Largest thumb src: ${largestImgSrc}`);

            // Reconstruct original Wikimedia Commons URL
            // https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Sannai-Maruyama_site04_2816.jpg/280px-Sannai-Maruyama_site04_2816.jpg
            // to https://upload.wikimedia.org/wikipedia/commons/e/ec/Sannai-Maruyama_site04_2816.jpg
            const match = largestImgSrc.match(/(.*\/commons\/)thumb\/(.*?\/.*?\/.*?)\/[^\/]+$/);
            let highResUrl = largestImgSrc;
            if (match) {
                highResUrl = `${match[1]}${match[2]}`;
            }

            console.log(`  -> High-res URL: ${highResUrl}`);

            let ext = path.extname(new URL(highResUrl).pathname) || '.jpg';
            if (ext.length > 5 || ext === "") ext = '.jpg';
            const dest = path.join(destDir, `${target.id}${ext}`);

            // Navigate and download buffer
            const viewSource = await page.goto(highResUrl);
            if (viewSource.status() !== 200) {
                console.log(`  -> Failed to download high-res, status ${viewSource.status()}`);
                continue;
            }

            const buffer = await viewSource.buffer();
            fs.writeFileSync(dest, buffer);
            console.log(`  -> Downloaded to: ${dest} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);

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
    console.log('Wikipedia largest image fetch complete.');
})();
