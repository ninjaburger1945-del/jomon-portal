const fs = require('fs');
const path = require('path');
const facilitiesPath = path.join(__dirname, '../app/data/facilities.json');
let data = JSON.parse(fs.readFileSync(facilitiesPath, 'utf-8'));

const wakasa = data.find(f => f.id === 'jomon-museum');
if (wakasa) {
    wakasa.url = 'https://www.fuku-e.com/spot/detail_1407.html';
    console.log('Fixed Wakasa URL to reliable Fukui tourism page.');
}

fs.writeFileSync(facilitiesPath, JSON.stringify(data, null, 2));
