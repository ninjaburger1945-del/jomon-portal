const fs = require('fs');

const candidates = [
    'https://www.town.fukui-wakasa.lg.jp/soshiki/14/', // jomon-museum, torihama
    'https://www.city.date.hokkaido.jp/funkawan/detail/00003112.html', // kitakogane
    'https://irie-takasago.net/museum/', // irie-takasago
    'https://www.town.shimosuwa.lg.jp/www/contents/1628139556094/index.html', // hoshigato
    'https://www.vill.hara.lg.jp/docs/1684.html', // aku
    'https://www.city.ichikawa.lg.jp/edu14/1111000021.html', // ubayama
    'https://www.city.ichikawa.lg.jp/edu14/1111000018.html', // soyata
    'https://www.city.karatsu.lg.jp/bunka/toshokan/hakubutsukan/matsurokan.html' // nabatake
];

async function testUrls() {
    for (const url of candidates) {
        try {
            const res = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                },
                signal: AbortSignal.timeout(8000)
            });
            console.log(`[${res.status}] ${url}`);
        } catch (e) {
            console.log(`[ERROR] ${url} - ${e.message}`);
        }
    }
}

testUrls();
