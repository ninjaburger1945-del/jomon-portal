const fs = require('fs');

const data = JSON.parse(fs.readFileSync('./app/data/facilities.json', 'utf-8'));

async function checkUrl(url) {
    try {
        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            redirect: 'follow', // fetch will follow redirects by default, but let's be explicit
            signal: AbortSignal.timeout(8000)
        });

        // Some sites return 200 but their body says "Not Found" etc.
        const text = await res.text();
        let isDead = !res.ok;

        if (res.ok && (
            text.includes('お探しのページが見つかりません') ||
            text.includes('ページが見つかりませんでした') ||
            text.includes('404 Not Found') ||
            text.includes('お探しのページは、移動または削除された') ||
            text.includes('ページが存在しません')
        )) {
            isDead = true;
        }

        return { url, status: res.status, ok: !isDead, finalUrl: res.url };
    } catch (err) {
        return { url, status: 'ERROR', ok: false, error: err.message };
    }
}

(async () => {
    console.log('--- Checking all URLs ---');
    let hasError = false;
    for (const facility of data) {
        if (facility.url && facility.url !== '#') {
            const result = await checkUrl(facility.url);
            if (!result.ok) {
                console.log(`[DEAD/ERROR] ${facility.id} (${facility.name})`);
                console.log(`  Target URL: ${facility.url}`);
                console.log(`  Final URL:  ${result.finalUrl}`);
                console.log(`  Status:     ${result.status}`);
                console.log(`  Error:      ${result.error || 'N/A'}`);
                console.log('--------------------------------------------------');
                hasError = true;
            }
        } else {
            console.log(`[NO_URL] ${facility.id} (${facility.name})`);
            hasError = true;
        }
    }

    if (!hasError) {
        console.log('All URLs are OK!');
    } else {
        console.log('Finished with some broken links detected.');
    }
})();
