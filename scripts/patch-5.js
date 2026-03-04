const fs = require('fs');
const facilitiesPath = './app/data/facilities.json';
const data = JSON.parse(fs.readFileSync(facilitiesPath, 'utf-8'));

const fixes = {
    'irie-takasago': 'https://irie-takasago.net/museum/',
    'satohama': 'http://satohama-jomon.jp/',
    'aku': 'https://www.hara.lg.jp/docs/1683.html', // Let's try to just give a fallback, or use the tourism site
    'ubayama': 'https://www.city.ichikawa.lg.jp/edu09/1531000004.html',
    'soyata': 'https://ichikawa-kankou.jp/spot/soya-kaidzuka/' // Official tourism association is safe
};

for (const f of data) {
    if (fixes[f.id]) {
        f.url = fixes[f.id];
    }
}

// Special check for Aku:
// Wait, I am just hardcoding the tourism site for Aku as well since hara.lg.jp seems to have reorganized.
const aku = data.find(f => f.id === 'aku');
aku.url = 'https://www.yatsugatake-jomon.com/spots/aku/';

fs.writeFileSync(facilitiesPath, JSON.stringify(data, null, 2));
console.log('Manually patched the 5 problematic links.');
