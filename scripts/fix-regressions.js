const fs = require('fs');
const path = require('path');

const facilitiesPath = path.join(__dirname, '../app/data/facilities.json');
const imgDir = path.join(__dirname, '../public/images/facilities');
let data = JSON.parse(fs.readFileSync(facilitiesPath, 'utf-8'));

// 1. Fix Wakasa URL (jomon-museum)
const wakasa = data.find(f => f.id === 'jomon-museum');
if (wakasa) {
    wakasa.url = 'https://www.town.fukui-wakasa.lg.jp/jomon/';
    console.log('Fixed Wakasa URL.');
}

// 2. Fix Togariishi Image (it was a 20KB corrupted/small file)
// Let's replace the togariishi image with a known solid one. 
// Actually, let's just use Togariishi's main website image, or a valid Wikipedia one.
// Let's download a fresh Togariishi image (Jomon Venus).
// I will do the download in a separate node fetch call inside this script or another.

// 3. Fix Case Sensitivity for all images.
data.forEach(facility => {
    if (facility.thumbnail && facility.thumbnail.startsWith('/images/facilities/')) {
        const filename = path.basename(facility.thumbnail);
        const lowerFilename = filename.toLowerCase();

        // Update JSON
        facility.thumbnail = `/images/facilities/${lowerFilename}`;

        // Rename file on disk if it exists and differs in case
        const oldPath = path.join(imgDir, filename);
        const newPath = path.join(imgDir, lowerFilename);

        if (oldPath !== newPath && fs.existsSync(oldPath)) {
            fs.renameSync(oldPath, newPath + '.tmp'); // Rename to tmp first to force case change on Windows
            fs.renameSync(newPath + '.tmp', newPath);
            console.log(`Renamed image: ${filename} -> ${lowerFilename}`);
        } else if (fs.existsSync(oldPath)) {
            // It's the same path (lowercase already), but let's ensure the file system actually has it lowercase
            // Windows is case insensitive, so fs.existsSync('FOO.JPG') is true even if file is 'foo.jpg'.
            // To be strictly safe, we read the directory contents and do exact match renaming.
        }
    }
});

fs.writeFileSync(facilitiesPath, JSON.stringify(data, null, 2));
console.log('Facilities JSON updated.');

// Exact case renaming for Windows
const files = fs.readdirSync(imgDir);
files.forEach(file => {
    const lower = file.toLowerCase();
    if (file !== lower) {
        fs.renameSync(path.join(imgDir, file), path.join(imgDir, lower + '.tmp'));
        fs.renameSync(path.join(imgDir, lower + '.tmp'), path.join(imgDir, lower));
        console.log(`Hard renamed to lowercase: ${file} -> ${lower}`);
    }
});

// Download a reliable Togariishi image.
const https = require('https');
const togariishiDest = path.join(imgDir, 'togariishi.jpg');
const solidTogariishiUrl = 'https://upload.wikimedia.org/wikipedia/commons/b/bd/Jomon_Venus.JPG';

https.get(solidTogariishiUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
    if (res.statusCode === 200) {
        const file = fs.createWriteStream(togariishiDest);
        res.pipe(file);
        file.on('finish', () => file.close());
        console.log('Successfully re-downloaded Togariishi image.');
    } else if (res.statusCode === 301 || res.statusCode === 302) {
        https.get(res.headers.location, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res2) => {
            if (res2.statusCode === 200) {
                const file = fs.createWriteStream(togariishiDest);
                res2.pipe(file);
                file.on('finish', () => file.close());
                console.log('Successfully re-downloaded Togariishi image after redirect.');
            }
        });
    } else {
        // If Wikipedia blocks us, grab from a different source or use a known good one.
        console.log('Failed to download Togariishi, status:', res.statusCode);
    }
});

// Re-download Sannai Maruyama just to be sure it's valid, as the previous one might have been the SVG or corrupted.
const sannaiDest = path.join(imgDir, 'sannaimaruyama.jpg');
const solidSannaiUrl = 'https://upload.wikimedia.org/wikipedia/commons/e/ec/Sannai-Maruyama_site04_2816.jpg';

https.get(solidSannaiUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
    if (res.statusCode === 200) {
        const file = fs.createWriteStream(sannaiDest);
        res.pipe(file);
        file.on('finish', () => file.close());
        console.log('Successfully re-downloaded Sannai Maruyama image.');
    } else if (res.statusCode === 301 || res.statusCode === 302) {
        https.get(res.headers.location, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res2) => {
            if (res2.statusCode === 200) {
                const file = fs.createWriteStream(sannaiDest);
                res2.pipe(file);
                file.on('finish', () => file.close());
                console.log('Successfully re-downloaded Sannai image after redirect.');
            }
        });
    } else {
        console.log('Failed to download Sannai, status:', res.statusCode);
    }
});

// Wakasa image
const wakasaDest = path.join(imgDir, 'jomon-museum.jpg');
const solidWakasaUrl = 'https://upload.wikimedia.org/wikipedia/commons/1/18/Wakasa_Mikata_Jomon_Museum01bs3200.jpg';

https.get(solidWakasaUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
    if (res.statusCode === 200) {
        const file = fs.createWriteStream(wakasaDest);
        res.pipe(file);
        file.on('finish', () => file.close());
        console.log('Successfully re-downloaded Wakasa Museum image.');
    } else if (res.statusCode === 301 || res.statusCode === 302) {
        https.get(res.headers.location, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res2) => {
            if (res2.statusCode === 200) {
                const file = fs.createWriteStream(wakasaDest);
                res2.pipe(file);
                file.on('finish', () => file.close());
                console.log('Successfully re-downloaded Wakasa image after redirect.');
            }
        });
    }
});

