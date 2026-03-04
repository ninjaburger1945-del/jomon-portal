const fs = require('fs');
const path = require('path');

const facilitiesPath = path.join(__dirname, '../app/data/facilities.json');
const imagesDir = path.join(__dirname, '../public/images/facilities');

const data = JSON.parse(fs.readFileSync(facilitiesPath, 'utf-8'));

for (const facility of data) {
    const baseName = facility.id;
    const pngPath = path.join(imagesDir, `${baseName}.png`);
    const jpgPath = path.join(imagesDir, `${baseName}.jpg`);
    const jpegPath = path.join(imagesDir, `${baseName}.jpeg`);

    // also check for underscores if hyphen is used, e.g. jomon-museum -> jomon_museum
    const baseNameUnder = baseName.replace(/-/g, '_');
    const pngPathUnder = path.join(imagesDir, `${baseNameUnder}.png`);
    const jpgPathUnder = path.join(imagesDir, `${baseNameUnder}.jpg`);

    if (fs.existsSync(pngPath)) {
        facility.thumbnail = `/images/facilities/${baseName}.png`;
    } else if (fs.existsSync(jpgPath)) {
        facility.thumbnail = `/images/facilities/${baseName}.jpg`;
    } else if (fs.existsSync(jpegPath)) {
        facility.thumbnail = `/images/facilities/${baseName}.jpeg`;
    } else if (fs.existsSync(pngPathUnder)) {
        facility.thumbnail = `/images/facilities/${baseNameUnder}.png`;
    } else if (fs.existsSync(jpgPathUnder)) {
        facility.thumbnail = `/images/facilities/${baseNameUnder}.jpg`;
    } else {
        console.log(`Warning: No image found for ${baseName}`);
    }
}

fs.writeFileSync(facilitiesPath, JSON.stringify(data, null, 2));
console.log('Fixed extensions in facilities.json.');
