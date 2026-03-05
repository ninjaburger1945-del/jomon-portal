const fs = require('fs');
const path = require('path');

const facilitiesPath = path.join(__dirname, '../app/data/facilities.json');
let data = JSON.parse(fs.readFileSync(facilitiesPath, 'utf-8'));

const newFacilities = [
    {
        "id": "jomon-culture-center",
        "name": "函館市縄文文化交流センター",
        "region": "Hokkaido-Tohoku",
        "prefecture": "北海道",
        "address": "北海道函館市臼尻町551-1",
        "description": "北海道唯一の国宝「中空土偶」を常設展示する施設。周辺の縄文遺跡群から出土した貴重な遺物を多数展示しています。",
        "url": "http://www.hjcc.jp/",
        "thumbnail": "",
        "tags": ["博物館", "国宝"],
        "lat": 41.9279,
        "lng": 140.9447
    },
    {
        "id": "jomopia-miyahata",
        "name": "じょーもぴあ宮畑",
        "region": "Hokkaido-Tohoku",
        "prefecture": "福島県",
        "address": "福島県福島市岡島字宮田78",
        "description": "縄文時代の集落跡である宮畑遺跡を整備した歴史公園と資料館。大規模な掘立柱建物跡などが復元されています。",
        "url": "http://www.f-shinkoukousha.or.jp/jyomopia/index.html",
        "thumbnail": "",
        "tags": ["史跡", "資料館"],
        "lat": 37.7925,
        "lng": 140.5097
    },
    {
        "id": "mawaki-jomon",
        "name": "真脇遺跡縄文館",
        "region": "Chubu",
        "prefecture": "石川県",
        "address": "石川県鳳珠郡能登町字真脇48-100",
        "description": "出土した多数のイルカ骨や、巨大な環状木柱根が有名な真脇遺跡のガイダンス施設。",
        "url": "http://www.mawakiiseki.jp/",
        "thumbnail": "",
        "tags": ["博物館", "史跡"],
        "lat": 37.3050,
        "lng": 137.2092
    },
    {
        "id": "tobinodai-museum",
        "name": "飛ノ台史跡公園博物館",
        "region": "Kanto",
        "prefecture": "千葉県",
        "address": "千葉県船橋市海神4-27-2",
        "description": "縄文時代早期の炉穴や貝塚が発見された飛ノ台遺跡を保存・展示する博物館。当時の生活を詳細に知ることができます。",
        "url": "https://www.city.funabashi.lg.jp/shisetsu/bunka/0001/0006/0001/p036786.html",
        "thumbnail": "",
        "tags": ["史跡", "博物館"],
        "lat": 35.7107,
        "lng": 139.9748
    },
    {
        "id": "mizuko-kaizuka",
        "name": "水子貝塚資料館",
        "region": "Kanto",
        "prefecture": "埼玉県",
        "address": "埼玉県富士見市水子2003-1",
        "description": "縄文時代前期の代表的な貝塚である水子貝塚を中心とした歴史公園・資料館。ムラの様子が復元されています。",
        "url": "https://www.city.fujimi.saitama.jp/madoguchi_shisetsu/02shisetsu/shiryoukan/mizukokaiduka/index.html",
        "thumbnail": "",
        "tags": ["貝塚", "資料館"],
        "lat": 35.8457,
        "lng": 139.5622
    }
];

// Append ensuring no duplicates
newFacilities.forEach(nf => {
    if (!data.find(f => f.id === nf.id || f.name === nf.name)) {
        data.push(nf);
    } else {
        console.log(`Facility ${nf.name} already exists. Skipping.`);
    }
});

fs.writeFileSync(facilitiesPath, JSON.stringify(data, null, 2));
console.log('Successfully added 5 new accurate facilities.');
