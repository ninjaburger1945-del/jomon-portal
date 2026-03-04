const https = require('https');
const http = require('http');

const urls = [
    'http://satohama-jomon.jp/',
    'https://satohama-jomon.jp/',
    'https://www.city.ichikawa.lg.jp/edu04/1111000002.html',
    'https://www.city.ichikawa.lg.jp/edu09/1531000005.html', // guess for soyata
    'https://www.vill.hara.lg.jp/docs/1684.html'
];
for (const u of urls) {
    const reqUrl = new URL(u);
    const req = (reqUrl.protocol === 'https:' ? https : http).get(u, (res) => {
        console.log(`[${res.statusCode}] ${u} -> ${res.headers.location || ''}`);
    }).on('error', e => console.log(`[ERR] ${u} : ${e.message}`));
}
