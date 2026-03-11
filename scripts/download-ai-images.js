const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const facilitiesPath = path.join(__dirname, '../app/data/facilities.json');
let data = JSON.parse(fs.readFileSync(facilitiesPath, 'utf8'));

async function run() {
  let updated = 0;

  for (const facility of data) {
    const expectedImagePath = path.join(__dirname, '../public/images/facilities', `${facility.id}_ai.png`);
    const isLocalMissingOrSmall = !fs.existsSync(expectedImagePath) || fs.statSync(expectedImagePath).size < 1000;

    if (!facility.thumbnail || isLocalMissingOrSmall) {
      console.log(`Processing ${facility.id}...`);
      const prompt = encodeURIComponent(`Jomon period archaeological site, ${facility.id.replace(/-/g, ' ')}, photorealistic, cinematic lighting, ancient Japan landscape, highly detailed nature`);
      const url = `https://image.pollinations.ai/prompt/${prompt}?width=1200&height=600&nologo=true`;
      
      let success = false;
      let attempt = 1;
      while (!success) {
        try {
          await sleep(5000); // Wait 5s before EACH request
          const imgRes = await fetch(url);
          if (imgRes.ok) {
            const arrayBuffer = await imgRes.arrayBuffer();
            fs.writeFileSync(expectedImagePath, Buffer.from(arrayBuffer));
            facility.thumbnail = `/images/facilities/${facility.id}_ai.png`;
            console.log(`Downloaded AI image for ${facility.id}`);
            updated++;
            success = true;
          } else if (imgRes.status === 429) {
            console.warn(`[WARN] 429 Too Many Requests on attempt ${attempt}. Waiting 15s...`);
            await sleep(15000);
            attempt++;
          } else {
            console.error(`HTTP Error ${imgRes.status}: ${imgRes.statusText}. Retrying in 10s...`);
            await sleep(10000);
            attempt++;
          }
        } catch (err) {
          console.error(`Attempt ${attempt} network error for ${facility.id}:`, err.message);
          await sleep(10000);
          attempt++;
        }
      }
    }
  }
  
  if (updated > 0) {
    fs.writeFileSync(facilitiesPath, JSON.stringify(data, null, 2));
    console.log(`Updated facilities.json and downloaded ${updated} images.`);
  } else {
    console.log('No replacement needed.');
  }
}

run();
