const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// We have already established through Powershell that these are exactly the files with 640x640 resolution.
const knownAIFiles = [
    'aku.png', 'hiraide.png', 'hoshigato.png', 'idojiri.png', 'irie_takasago.png',
    'jomon_museum.png', 'kamegaoka.png', 'kamikuroiwa.png', 'kitakogane.png',
    'komakino.png', 'nabatake.png', 'ofune.png', 'oomori.png', 'oyu.png',
    'satohama.png', 'soyata.png', 'torihama.png', 'tsugumo.png', 'ubayama.png',
    'uenohara.png', 'umaikata.png', 'yoshigo.png'
];

const facilitiesPath = path.join(__dirname, 'app/data/facilities.json');
let data = JSON.parse(fs.readFileSync(facilitiesPath, 'utf8'));

let filesRenamed = 0;

data.forEach(facility => {
    if (facility.thumbnail) {
        const basename = path.basename(facility.thumbnail);
        if (knownAIFiles.includes(basename)) {
            const oldPath = path.join(__dirname, 'public', facility.thumbnail);
            const newBasename = basename.replace('.png', '_ai.png');
            const newThumbnail = facility.thumbnail.replace(basename, newBasename);
            const newPath = path.join(__dirname, 'public', newThumbnail);
            
            if (fs.existsSync(oldPath)) {
                fs.renameSync(oldPath, newPath);
                facility.thumbnail = newThumbnail;
                console.log(`Renamed ${oldPath} to ${newPath}`);
                filesRenamed++;
            }
        }
    }
});

fs.writeFileSync(facilitiesPath, JSON.stringify(data, null, 2));
console.log(`Successfully renamed ${filesRenamed} AI images and updated facilities.json`);
