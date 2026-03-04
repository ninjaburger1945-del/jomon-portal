const fs = require('fs');
const path = require('path');
const facilitiesPath = path.join(__dirname, '../app/data/facilities.json');
let data = JSON.parse(fs.readFileSync(facilitiesPath, 'utf-8'));

const wakasa = data.find(f => f.id === 'jomon-museum');
if (wakasa) {
    wakasa.url = 'https://www.town.fukui-wakasa.lg.jp/jomon/index.html';
    console.log('Fixed Wakasa URL with explicit index.html');
}

fs.writeFileSync(facilitiesPath, JSON.stringify(data, null, 2));
