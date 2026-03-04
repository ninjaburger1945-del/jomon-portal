const fs = require('fs');
const facilitiesPath = './app/data/facilities.json';
const data = JSON.parse(fs.readFileSync(facilitiesPath, 'utf-8'));

// Manually patch Yamanshi Prefectural Museum of Archaeology because it's correct but failed strict text match
const yamanashi = data.find(f => f.id === 'yamanashi-kouko');
if (yamanashi) {
    yamanashi.url = 'https://www.pref.yamanashi.jp/kouko-hak/';
}

fs.writeFileSync(facilitiesPath, JSON.stringify(data, null, 2));

console.log('--- 修復結果・最終URLと画像URL ---');
const targets = ['sannaimaruyama', 'togariishi', 'korekawa', 'jomon-museum'];

data.forEach(f => {
    if (targets.includes(f.id)) {
        console.log(`[画像更新] ${f.name} -> ${f.thumbnail}`);
    }
});

console.log('\n--- リンク最終ステータス ---');
data.forEach(f => {
    console.log(`[Link] ${f.name} | ${f.url}`);
});
