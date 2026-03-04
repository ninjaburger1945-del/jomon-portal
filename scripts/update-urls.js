const fs = require('fs');
const path = require('path');

const facilitiesPath = path.join(__dirname, '../app/data/facilities.json');
const data = JSON.parse(fs.readFileSync(facilitiesPath, 'utf-8'));

const updates = {
    'jomon-museum': 'https://www.wakasabay.jp/list/detail?kana=wakasamikatajomonhakubutsukan',
    'torihama': 'https://www.wakasabay.jp/list/detail?kana=wakasamikatajomonhakubutsukan',
    'umaikata': 'https://www.nbz.or.jp/',
    'ofune': 'https://jomon-japan.jp/learn/jomon-sites/ofune',
    'kamegaoka': 'https://jomon-tsugaru.jp/',
    'kitakogane': 'https://date-kanko.jp/spot/11/',
    'irie-takasago': 'http://www.town.toyako.hokkaido.jp/tourism/history/his001/',
    'hiraide': 'https://tokimeguri.jp/guide/hiraideiseki/',
    'oomori': 'https://shinagawa-kanko.or.jp/spot/oomorikaiduka/',
    'hoshigato': 'https://shimosuwaonsen.jp/spot/hoshigato/',
    'yoshigo': 'https://www.taharakankou.gr.jp/spot/000049.html',
    'tsugumo': 'https://www.okayama-kanko.jp/spot/10775',
    'kamikuroiwa': 'https://kuma-kanko.com/spot/160/',
    'satohama': 'http://satohama-jomon.jp/',
    'aku': 'https://www.hara.lg.jp/docs/1684.html',
    'ubayama': 'https://www.ichikawa.lg.jp/edu14/1111000021.html',
    'soyata': 'https://www.ichikawa.lg.jp/edu14/1111000018.html',
    'nabatake': 'https://www.city.karatsu.saga.jp/bunka/toshokan/hakubutsukan/matsurokan.html'
};

let count = 0;
for (const facility of data) {
    if (updates[facility.id]) {
        facility.url = updates[facility.id];
        delete facility.urlDead; // remove urlDead flag if present
        count++;
    }
}

fs.writeFileSync(facilitiesPath, JSON.stringify(data, null, 2));
console.log(`Updated URLs for ${count} facilities.`);
