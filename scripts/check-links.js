const fs = require('fs');
const https = require('https');
const http = require('http');

const data = JSON.parse(fs.readFileSync('./app/data/facilities.json', 'utf-8'));

async function checkUrl(urlStr) {
    return new Promise((resolve) => {
        const protocol = urlStr.startsWith('https') ? https : http;
        const req = protocol.get(urlStr, {
            timeout: 5000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        }, (res) => {
            let isDead = res.statusCode >= 400;
            let bodyStr = '';
            res.on('data', chunk => bodyStr += chunk);
            res.on('end', () => {
                // Some sites return 200 but say "Not Found" or "ページが見つかりません"
                if (res.statusCode === 200 && (bodyStr.includes('お探しのページが見つかりません') || bodyStr.includes('ページが見つかりませんでした') || bodyStr.includes('Not Found') || bodyStr.includes('お探しのページは、移動または削除された'))) {
                    isDead = true;
                }
                resolve({ url: urlStr, status: res.statusCode, isDead, redirect: res.headers.location });
            });
        }).on('error', (e) => {
            resolve({ url: urlStr, status: 0, isDead: true, error: e.message });
        });

        req.on('timeout', () => {
            req.abort();
            resolve({ url: urlStr, status: 0, isDead: true, error: 'TIMEOUT' });
        });
    });
}

(async () => {
    for (const facility of data) {
        if (facility.url && facility.url !== '#') {
            const res = await checkUrl(facility.url);
            if (res.isDead || res.redirect) {
                console.log(`[DEAD/REDIRECT] ${facility.id} (${facility.name}): ${facility.url}`);
                console.log(`  -> Status: ${res.status}, Redirect: ${res.redirect || 'none'}, Error: ${res.error || 'none'}`);
            }
        } else {
            console.log(`[NO_URL] ${facility.id} (${facility.name})`);
        }
    }
})();
