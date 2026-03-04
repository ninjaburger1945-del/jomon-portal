const puppeteer = require('puppeteer');
const fs = require('fs');

const facilitiesPath = './app/data/facilities.json';
const data = JSON.parse(fs.readFileSync(facilitiesPath, 'utf-8'));

function extractKeywords(facility) {
    let name = facility.name.replace(/特別史跡|史跡|県立|市立|町立|村立|国指定|遺跡庭園/g, '').trim();
    const shortName = name.split(' ')[0];
    return { name, shortName, pref: facility.prefecture };
}

async function verifyPageDeep(page, url, keywords) {
    try {
        const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
        const status = response.status();

        if (status >= 400) return { ok: false, reason: `HTTP ${status}` };

        const title = await page.title();
        const metaDesc = await page.$eval('meta[name="description"]', el => el.content).catch(() => '');
        const textToCheck = [title, metaDesc].join(' ');

        // Explicit 404 indicators
        const isErrorPage =
            title.includes('404') ||
            title.includes('Not Found') ||
            title.includes('見つかりません') ||
            textToCheck.includes('お探しのページが見つかりません') ||
            textToCheck.includes('ページが存在しません') ||
            textToCheck.includes('移動または削除');

        if (isErrorPage) return { ok: false, reason: 'Error page content detected in title/meta' };

        // Validations: must contain part of the name
        if (textToCheck.includes(keywords.shortName) || textToCheck.includes(keywords.name)) {
            return { ok: true, title, reason: 'Keyword match' };
        } else {
            // Allow specific known overrides
            if (keywords.name === '吉胡貝塚' && textToCheck.includes('シェルマ')) return { ok: true, title };
            if (keywords.name === '入江・高砂貝塚' && (textToCheck.includes('入江') || textToCheck.includes('高砂'))) return { ok: true, title };
            if (keywords.name === '星ヶ塔黒曜石原産地遺跡' && (textToCheck.includes('星ヶ塔') || textToCheck.includes('黒曜石'))) return { ok: true, title };
            if (keywords.name === '阿久遺跡' && textToCheck.includes('阿久')) return { ok: true, title };
            if (keywords.name === '里浜貝塚' && textToCheck.includes('奥松島縄文村')) return { ok: true, title };
            if (keywords.name === '菜畑遺跡' && textToCheck.includes('末盧館')) return { ok: true, title };

            return { ok: false, title, reason: `Name "${keywords.shortName}" missing from title: [${title}] and meta: [${metaDesc}]` };
        }
    } catch (e) {
        return { ok: false, reason: e.message };
    }
}

async function searchCandidatesDeep(page, facility) {
    const { name, pref } = extractKeywords(facility);
    const query = `${name} ${pref} 施設詳細 OR 遺跡詳細`; // Force deep pages
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
            else if (l.href.includes('.net') || l.href.includes('.com') || l.href.includes('.jp')) score += 5;

            if (l.href.includes('.pdf')) score -= 100;
            if (l.href.includes('wikipedia.org')) score -= 100;
            if (l.href.includes('jalan.net') || l.href.includes('tripadvisor') || l.href.includes('rurubu') || l.href.includes('iko-yo.net')) score -= 50;
            if (l.text.includes('公式') || l.text.includes('詳細')) score += 20;

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
    console.log('--- Strict Meta-Tag Link Verification Started ---');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=ja-JP']
    });

    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'ja-JP,ja;q=0.9' });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');

    const logs = [];

    for (const facility of data) {
        console.log(`\nVerifying [${facility.name}]...`);
        const oldUrl = facility.url;
        const keywords = extractKeywords(facility);
        let isOk = false;
        let newUrl = oldUrl;
        let statusMsg = '';
        let pageTitle = '';

        if (oldUrl && oldUrl !== '#') {
            const verifyRes = await verifyPageDeep(page, oldUrl, keywords);
            if (verifyRes.ok) {
                isOk = true;
                statusMsg = 'OK (Original)';
                pageTitle = verifyRes.title;
                console.log(`  -> OK: ${oldUrl}`);
            } else {
                console.log(`  -> Original Failed: ${verifyRes.reason}`);
            }
        }

        if (!isOk) {
            console.log(`  -> Searching for better candidates...`);
            const candidates = await searchCandidatesDeep(page, facility);
            for (const candidate of candidates) {
                console.log(`    -> Testing candidate: ${candidate}`);
                const verifyRes = await verifyPageDeep(page, candidate, keywords);
                if (verifyRes.ok) {
                    isOk = true;
                    statusMsg = `Fixed (Auto Found)`;
                    newUrl = candidate;
                    pageTitle = verifyRes.title;
                    console.log(`  -> Success with: ${newUrl}`);
                    break;
                } else {
                    console.log(`      -> Failed: ${verifyRes.reason}`);
                }
            }
        }

        if (!isOk) {
            statusMsg = 'FAILED (Not Found)';
            console.log(`  -> ALL FAILED for ${facility.name}`);
        } else {
            facility.url = newUrl;
        }

        logs.push(`${facility.name} | ${oldUrl} | ${newUrl} | [${pageTitle.substring(0, 25)}] ${statusMsg}`);
    }

    await browser.close();

    fs.writeFileSync(facilitiesPath, JSON.stringify(data, null, 2));

    console.log('\n--- 修復ログ (Link Verification) ---');
    for (const log of logs) {
        console.log(log);
    }
    console.log('\nDeep verification complete.');
})();
