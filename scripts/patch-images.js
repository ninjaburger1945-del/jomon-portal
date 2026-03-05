const fs = require('fs');
const path = require('path');

const facilitiesPath = path.join(__dirname, '../app/data/facilities.json');
let data = JSON.parse(fs.readFileSync(facilitiesPath, 'utf-8'));

// The precise Wikipedia original image URLs we obtained
const updates = {
    'jomon-culture-center': 'https://upload.wikimedia.org/wikipedia/commons/1/1d/Michinoeki_jyoumonRoman.JPG',
    'jomopia-miyahata': 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Miyahata_Site.jpg',
    'mawaki-jomon': 'https://upload.wikimedia.org/wikipedia/commons/f/f6/Mawaki_Site.jpg',
    'tobinodai-museum': 'https://upload.wikimedia.org/wikipedia/commons/c/cb/Tobinodai_Historic_Site_Park_Restored_Roana%EF%BC%88Fire-Pit%EF%BC%89_20250209.jpg',
    'mizuko-kaizuka': 'https://upload.wikimedia.org/wikipedia/commons/5/54/Fujimi_Mizukokaiduka_Park_3.JPG'
};

let modified = false;

data = data.map(facility => {
    if (updates[facility.id]) {
        facility.thumbnail = updates[facility.id];
        console.log(`Updated thumbnail for ${facility.name} to ${facility.thumbnail}`);
        modified = true;
    }
    return facility;
});

if (modified) {
    fs.writeFileSync(facilitiesPath, JSON.stringify(data, null, 2));
    console.log('Successfully updated facilities.json with real images.');
} else {
    console.log('No matches found to update.');
}
