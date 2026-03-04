const fs = require('fs');
const puppeteer = require('puppeteer');

const facilitiesPath = './app/data/facilities.json';
const data = JSON.parse(fs.readFileSync(facilitiesPath, 'utf-8'));

function getKeywords(facility) {
    let name = facility.name.replace(/特別史跡|史跡|県立|市立|町立|村立|国指定|遺跡庭園/g, '').trim();
    const shortName = name.split(' ')[0];
    return { name, shortName, pref: facility.prefecture };
}

async function verifyPage(page, url, keywords) {
    try {
        const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
        const status = response.status();

        if (status >= 400) return { ok: false, reason: `HTTP ${status}` };

        const title = await page.title();
        const content = await page.content();

        const isErrorPage =
            title.includes('404') ||
            title.includes('Not Found') ||
            title.includes('見つかりません') ||
            content.includes('お探しのページが見つかりません') ||
            content.includes('ページが存在しません') ||
            content.includes('移動または削除');

        if (isErrorPage) return { ok: false, reason: 'Error page content detected' };

        const h1s = await page.$$eval('h1', els => els.map(e => e.innerText));
        const textToCheck = [title, ...h1s].join(' ');

        if (textToCheck.includes(keywords.shortName) || textToCheck.includes(keywords.name)) {
            return { ok: true };
        } else {
            if (keywords.name === '吉胡貝塚' && textToCheck.includes('シェルマ')) return { ok: true };
            if (keywords.name === '入江・高砂貝塚' && (textToCheck.includes('入江') || textToCheck.includes('高砂'))) return { ok: true };
            if (keywords.name === '星ヶ塔黒曜石原産地遺跡' && (textToCheck.includes('星ヶ塔') || textToCheck.includes('黒曜石'))) return { ok: true };
            if (keywords.name === '阿久遺跡' && textToCheck.includes('阿久')) return { ok: true };

            return { ok: false, reason: `Name "${keywords.shortName}" not found in title/H1. Title: ${title}` };
        }

    } catch (e) {
        return { ok: false, reason: e.message };
    }
}

async function searchCandidates(page, facility) {
    const { name, pref } = getKeywords(facility);
    const query = `${name} ${pref} 公式`;
    const searchUrl = `https://search.yahoo.co.jp/search?p=${encodeURIComponent(query)}`;

    try {
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        const links = await page.$$eval('a', els => els.map(e => ({ href: e.href, text: e.innerText })));

        const validLinks = links.filter(l =>
            l.href && l.href.startsWith('http') &&
            !l.href.includes('yahoo.co.jp') &&
            !l.href.includes('google.')
        );

        const scoredLinks = validLinks.map(l => {
            let score = 0;
            if (l.href.includes('.lg.jp')) score += 50;
            else if (l.href.includes('.go.jp')) score += 40;
            else if (l.href.includes('.ed.jp')) score += 30;
            else if (l.href.includes('.or.jp')) score += 20;
            else if (l.href.includes('.jp')) score += 5;

            if (l.href.includes('.pdf')) score -= 100;
            if (l.href.includes('wikipedia.org')) score -= 100;
            if (l.href.includes('jalan.net') || l.href.includes('tripadvisor') || l.href.includes('rurubu') || l.href.includes('iko-yo.net')) score -= 50;
            if (l.text.includes('公式')) score += 20;

            return { ...l, score };
        }).filter(l => l.score > -50).sort((a, b) => b.score - a.score);

        const uniqueHrefs = [...new Set(scoredLinks.map(l => l.href))];
        return uniqueHrefs.slice(0, 5);
    } catch (e) {
        console.error(`Search failed for ${name}: ${e.message}`);
        return [];
    }
}

(async () => {
    console.log('--- Strict Automated Link Healing Started ---');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=ja-JP']
    });

    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7' });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const logs = [];

    for (const facility of data) {
        const oldUrl = facility.url;
        const keywords = getKeywords(facility);

        console.log(`\nVerifying ${facility.name} ...`);
        let isOk = false;
        let newUrl = null;
        let statusMsg = '';

        if (facility.id === 'irie-takasago') {
            const forcedUrl = 'https://irie-takasago.net/museum/';
            const verifyRes = await verifyPage(page, forcedUrl, keywords);
            if (verifyRes.ok) {
                isOk = true;
                statusMsg = 'Fixed (User Provided)';
                newUrl = forcedUrl;
                console.log(`  -> Applied User Provided: ${newUrl}`);
            }
        }

        if (!isOk && oldUrl && oldUrl !== '#') {
            const verifyRes = await verifyPage(page, oldUrl, keywords);
            if (verifyRes.ok) {
                isOk = true;
                statusMsg = 'OK (Original)';
                newUrl = oldUrl;
                console.log(`  -> OK: ${newUrl}`);
            } else {
                console.log(`  -> Original Failed: ${verifyRes.reason}`);
            }
        }

        if (!isOk) {
            console.log(`  -> Searching for replacements for ${facility.name}...`);
            const candidates = await searchCandidates(page, facility);
            for (const candidate of candidates) {
                console.log(`    -> Testing candidate: ${candidate}`);
                const verifyRes = await verifyPage(page, candidate, keywords);
                if (verifyRes.ok) {
                    isOk = true;
                    statusMsg = 'Fixed (Auto Found)';
                    newUrl = candidate;
                    console.log(`  -> Success with: ${newUrl}`);
                    break;
                } else {
                    console.log(`      -> Failed: ${verifyRes.reason}`);
                }
            }
        }

        if (!isOk) {
            statusMsg = 'FAILED (Not Found)';
            newUrl = oldUrl;
            console.log(`  -> ALL FAILED for ${facility.name}`);
        }

        facility.url = newUrl;
        if (facility.urlDead) delete facility.urlDead;

        logs.push(`${facility.name} | ${oldUrl} | ${newUrl} | ${statusMsg}`);
    }

    await browser.close();

    fs.writeFileSync(facilitiesPath, JSON.stringify(data, null, 2));

    console.log('\n--- 修復ログ ---');
    for (const log of logs) {
        console.log(log);
    }
    console.log('\nAll done. Ready to deploy.');
})();
