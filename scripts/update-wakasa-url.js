const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../app/data/facilities.json');
const data = JSON.parse(fs.readFileSync(file, 'utf-8'));

const f = data.find(x => x.id === 'jomon-museum');
if (f) {
    f.url = 'https://www.town.fukui-wakasa.lg.jp/soshiki/wakasamikatajomonhakubutsukan/gyomuannai/955.html';
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    console.log('Successfully updated Wakasa URL to the new provided link.');
}
