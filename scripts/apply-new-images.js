const fs = require('fs');
const path = require('path');

const srcDir = 'C:\\Users\\ninja\\.gemini\\antigravity\\brain\\4411a7be-d6c8-4d32-96bc-be8fcbf4e9cb';
const destDir = path.join(__dirname, '../public/images/facilities');
const facilitiesPath = path.join(__dirname, '../app/data/facilities.json');

// Find the exact filenames of the generated images
const brainFiles = fs.readdirSync(srcDir);
const sannaiSrc = brainFiles.find(f => f.startsWith('sannaimaruyama_jomon_') && f.endsWith('.png'));
const togariishiSrc = brainFiles.find(f => f.startsWith('togariishi_venus_') && f.endsWith('.png'));

// Copy to public folder
if (sannaiSrc) {
    fs.copyFileSync(path.join(srcDir, sannaiSrc), path.join(destDir, 'sannaimaruyama_ai.png'));
    console.log('Copied Sannai AI image.');
}
if (togariishiSrc) {
    fs.copyFileSync(path.join(srcDir, togariishiSrc), path.join(destDir, 'togariishi_ai.png'));
    console.log('Copied Togariishi AI image.');
}

// Update facilities.json
let data = JSON.parse(fs.readFileSync(facilitiesPath, 'utf-8'));

data.forEach(f => {
    if (f.id === 'sannaimaruyama') f.thumbnail = '/images/facilities/sannaimaruyama_ai.png';
    if (f.id === 'togariishi') f.thumbnail = '/images/facilities/togariishi_ai.png';
    if (f.id === 'korekawa') f.thumbnail = '/images/facilities/korekawa_ogp.jpg';
    if (f.id === 'jomon-museum') f.thumbnail = '/images/facilities/jomon-museum_ogp.jpg';
});

fs.writeFileSync(facilitiesPath, JSON.stringify(data, null, 2));
console.log('Updated JSON.');
