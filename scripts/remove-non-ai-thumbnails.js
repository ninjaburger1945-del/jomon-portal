const fs = require('fs');
const path = require('path');

const facilitiesPath = path.join(__dirname, '../app/data/facilities.json');
let data = JSON.parse(fs.readFileSync(facilitiesPath, 'utf8'));

let updated = 0;
data.forEach(facility => {
    if (facility.thumbnail && !facility.thumbnail.includes('_ai.png')) {
        facility.thumbnail = ""; // clear the non-ai image so it falls back to pollinations
        updated++;
    }
});

fs.writeFileSync(facilitiesPath, JSON.stringify(data, null, 2));
console.log(`Cleared thumbnail for ${updated} facilities.`);
