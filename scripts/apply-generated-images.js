const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\ninja\\.gemini\\antigravity\\brain\\4b085511-2b7d-432d-999c-da43f0fdedd0';
const facilitiesPath = path.join(__dirname, '../app/data/facilities.json');
const destDir = path.join(__dirname, '../public/images/facilities');

let data = JSON.parse(fs.readFileSync(facilitiesPath, 'utf8'));

const files = fs.readdirSync(brainDir);

let updatedCount = 0;
data.forEach(facility => {
    if (!facility.thumbnail) {
        // Find the generated image matching the ID
        // The ID might have hyphens but the image name has underscores, e.g., jomon-museum -> jomon_museum
        const idWithUnderscores = facility.id.replace(/-/g, '_');
        const match = files.find(f => f.startsWith(idWithUnderscores + '_') && f.endsWith('.png'));
        
        if (match) {
            const src = path.join(brainDir, match);
            const destName = `${facility.id}_ai.png`;
            const dest = path.join(destDir, destName);
            
            fs.copyFileSync(src, dest);
            facility.thumbnail = `/images/facilities/${destName}`;
            console.log(`Copied ${match} to ${destName}`);
            updatedCount++;
        } else {
            console.log(`No matching image found in brain dir for ${facility.id}`);
        }
    }
});

fs.writeFileSync(facilitiesPath, JSON.stringify(data, null, 2));
console.log(`Updated ${updatedCount} facilities with new generated AI image paths.`);
