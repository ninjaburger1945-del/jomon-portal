const https = require('https');
const fs = require('fs');
const path = require('path');

const images = [
    { id: 'sannaimaruyama', url: 'https://upload.wikimedia.org/wikipedia/commons/e/ec/Sannai-Maruyama_site04_2816.jpg', ext: '.jpg' },
    { id: 'togariishi', url: 'https://upload.wikimedia.org/wikipedia/commons/b/bd/Jomon_Venus.JPG', ext: '.jpg' },
    { id: 'korekawa', url: 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Gassho_Dogu_Hachinohe_Aomori.JPG', ext: '.jpg' },
    { id: 'jomon-museum', url: 'https://upload.wikimedia.org/wikipedia/commons/1/18/Wakasa_Mikata_Jomon_Museum01bs3200.jpg', ext: '.jpg' }
];

const destDir = path.join(__dirname, '../public/images/facilities');
const facilitiesPath = path.join(__dirname, '../app/data/facilities.json');
const data = JSON.parse(fs.readFileSync(facilitiesPath, 'utf-8'));

function download(urlStr, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        };
        https.get(urlStr, options, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to download ${urlStr}: ${res.statusCode}`));
                return;
            }
            res.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
}

(async () => {
    console.log('--- Downloading High-Res Images ---');
    for (const img of images) {
        const dest = path.join(destDir, `${img.id}${img.ext}`);
        try {
            await download(img.url, dest);
            console.log(`Downloaded ${img.id} -> ${dest}`);

            const facility = data.find(f => f.id === img.id);
            if (facility) {
                const oldThumb = facility.thumbnail;
                facility.thumbnail = `/images/facilities/${img.id}${img.ext}`;
                console.log(`  Updated JSON: ${oldThumb} -> ${facility.thumbnail}`);
            }
        } catch (e) {
            console.log(`Error downloading ${img.id}: ${e.message}`);
        }
    }

    // Also check for picsum placeholders
    let picsumCount = 0;
    for (const facility of data) {
        if (facility.thumbnail && (facility.thumbnail.includes('picsum') || facility.thumbnail.includes('placehold'))) {
            console.log(`[WARNING] Placeholder found in ${facility.id}: ${facility.thumbnail}`);
            picsumCount++;
        }
    }
    if (picsumCount === 0) {
        console.log('Success: No placeholder images found in the dataset.');
    }

    fs.writeFileSync(facilitiesPath, JSON.stringify(data, null, 2));
    console.log('Finished updating images.');
})();
