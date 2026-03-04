const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const stream = require('stream');
const { promisify } = require('util');

const pipeline = promisify(stream.pipeline);

const facilitiesPath = path.join(__dirname, '../app/data/facilities.json');
const imagesDir = path.join(__dirname, '../public/images/facilities');

if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
}

let facilities = JSON.parse(fs.readFileSync(facilitiesPath, 'utf8'));

async function fetchImage(url, destPath) {
    const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        timeout: 10000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });
    await pipeline(response.data, fs.createWriteStream(destPath));
}

async function processFacility(facility) {
    console.log(`\nProcessing: ${facility.name} (${facility.url})`);

    let imageUrl = null;
    let isOgp = false;

    // もしすでに画像がローカルに存在していて、Picsumでない場合はスキップする
    if (facility.thumbnail && !facility.thumbnail.includes('picsum') && facility.thumbnail !== "") {
        const localPath = path.join(__dirname, '../public', facility.thumbnail);
        if (fs.existsSync(localPath)) {
            console.log(`  Already has a local image: ${facility.thumbnail}`);
            // return facility; // 強制的に再取得させたい場合はコメントアウト
        }
    }

    try {
        const response = await axios.get(facility.url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const $ = cheerio.load(response.data);
        const ogImage = $('meta[property="og:image"]').attr('content');

        if (ogImage) {
            imageUrl = ogImage.startsWith('http') ? ogImage : new URL(ogImage, facility.url).href;
            console.log(`  Found OGP image: ${imageUrl}`);
            isOgp = true;
        } else {
            console.log(`  No OGP image found.`);
        }
    } catch (e) {
        console.error(`  Error fetching URL ${facility.url}: ${e.message}`);
        if (e.response && e.response.status === 404) {
            console.error(`  => DEAD LINK DETECTED: 404! NEED TO FIX.`);
            facility.urlDead = true;
        }
    }

    if (imageUrl) {
        const ext = isOgp ? (imageUrl.split('.').pop().split('?')[0].toLowerCase() || 'jpg') : 'jpg';
        let safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg';
        const filename = `${facility.id}.${safeExt}`;
        const destPath = path.join(imagesDir, filename);

        try {
            console.log(`  Downloading image to ${destPath}...`);
            await fetchImage(imageUrl, destPath);
            facility.thumbnail = `/images/facilities/${filename}`;
            console.log(`  Success! Thumbnail updated to OGP.`);
        } catch (e) {
            console.error(`  Failed to download image: ${e.message}`);
            facility.needsGeneration = true;
            facility.thumbnail = "";
        }
    } else {
        facility.needsGeneration = true;
        facility.thumbnail = "";
    }

    return facility;
}

async function run() {
    for (let i = 0; i < facilities.length; i++) {
        facilities[i] = await processFacility(facilities[i]);
    }
    fs.writeFileSync(facilitiesPath, JSON.stringify(facilities, null, 2), 'utf8');

    const needsGen = facilities.filter(f => f.needsGeneration);
    console.log(`\nFinished updating facilities. ${needsGen.length} facilities need image generation.`);
}

run();
