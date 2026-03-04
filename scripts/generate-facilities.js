const fs = require('fs');
const path = require('path');

// 有名な縄文遺跡・博物館のベースデータ
const baseFacilities = [
    { id: "sannaimaruyama", name: "特別史跡 三内丸山遺跡", region: "Hokkaido-Tohoku", prefecture: "青森県", address: "青森県青森市三内字丸山305", description: "日本最大級の縄文集落跡。大型竪穴建物跡や大型掘立柱建物跡が復元されており、縄文時代のムラの様子を体感できます。", url: "https://sannaimaruyama.pref.aomori.jp/", thumbnail: "https://placehold.co/600x400/8B4513/FFF?text=Sannaimaruyama", tags: ["史跡", "博物館"], lat: 40.8114, lng: 140.6953 },
    { id: "togariishi", name: "茅野市尖石縄文考古館", region: "Chubu", prefecture: "長野県", address: "長野県茅野市豊平4734-132", description: "国宝に指定された2体の土偶「縄文のビーナス」と「仮面の女神」を所蔵し、八ヶ岳山麓の縄文文化を伝える考古館。", url: "https://www.city.chino.lg.jp/site/togariishi/", thumbnail: "https://placehold.co/600x400/556B2F/FFF?text=Togariishi", tags: ["博物館", "国宝"], lat: 36.0089, lng: 138.2144 },
    { id: "kasori", name: "加曽利貝塚博物館", region: "Kanto", prefecture: "千葉県", address: "千葉県千葉市若葉区桜木8-33-1", description: "世界最大規模の貝塚である特別史跡 加曽利貝塚。縄文人の食生活や貝塚の形成過程を学ぶことができます。", url: "https://www.city.chiba.jp/kasori/", thumbnail: "https://placehold.co/600x400/A0522D/FFF?text=Kasori", tags: ["貝塚", "博物館"], lat: 35.6264, lng: 140.1656 },
    { id: "korekawa", name: "八戸市埋蔵文化財センター 是川縄文館", region: "Hokkaido-Tohoku", prefecture: "青森県", address: "青森県八戸市大字是川字横山1", description: "国宝の「合掌土偶」や精巧な漆器などを展示。是川遺跡や風張1遺跡から出土した貴重な遺物が見どころ。", url: "https://www.korekawa-jomon.jp/", thumbnail: "https://placehold.co/600x400/8B4513/FFF?text=Korekawa", tags: ["博物館", "国宝"], lat: 40.4851, lng: 141.4886 },
    { id: "idojiri", name: "井戸尻考古館", region: "Chubu", prefecture: "長野県", address: "長野県諏訪郡富士見町境7053", description: "独特の造形美を持つ「井戸尻式土器」や、水煙渦巻文深鉢など、縄文中期を代表する芸術的な土器群を展示。", url: "https://userweb.alles.or.jp/fujimi/idojiri.html", thumbnail: "https://placehold.co/600x400/556B2F/FFF?text=Idojiri", tags: ["博物館", "土器"], lat: 35.8893, lng: 138.2818 },
    { id: "jomon-museum", name: "若狭三方縄文博物館", region: "Chubu", prefecture: "福井県", address: "福井県三方上中郡若狭町鳥浜122-28-1", description: "鳥浜貝塚などの出土品を中心に、縄文人の技術や環境利用について展示。丸木舟や漆器なども紹介。", url: "http://www.wakasamikata-jomon.com/", thumbnail: "https://placehold.co/600x400/A0522D/FFF?text=Wakasa+Mikata", tags: ["博物館", "貝塚"], lat: 35.5847, lng: 135.9084 },
    { id: "umaikata", name: "新潟県立歴史博物館", region: "Chubu", prefecture: "新潟県", address: "新潟県長岡市関原町1丁目字権現堂2247番2", description: "火焔型土器の全盛期である信濃川流域の縄文文化を中心に、新潟県の歴史を俯瞰する博物館。ダイナミックな縄文展示が特徴。", url: "http://nbz.or.jp/", thumbnail: "https://placehold.co/600x400/8B4513/FFF?text=Niigata+History", tags: ["博物館", "火焔型土器"], lat: 37.4475, lng: 138.7904 },
    { id: "uenohara", name: "上野原縄文の森", region: "Kyushu", prefecture: "鹿児島県", address: "鹿児島県霧島市国分上野原縄文の森1-1", description: "約9500年前の大集落跡である上野原遺跡。広大な敷地に復元集落や展示館があり、南九州の縄文文化を感じることができます。", url: "https://www.jomon-no-mori.jp/", thumbnail: "https://placehold.co/600x400/556B2F/FFF?text=Uenohara", tags: ["史跡", "博物館"], lat: 31.7345, lng: 130.8033 },
    { id: "maibun", name: "山梨県立考古博物館", region: "Chubu", prefecture: "山梨県", address: "山梨県甲府市下曽根町923", description: "山梨県内の豊かな縄文時代の出土品を展示。水煙文土器や精巧な土偶など、縄文人たちの高い芸術性を確認できます。", url: "https://www.pref.yamanashi.jp/kouko-hak/", thumbnail: "https://placehold.co/600x400/A0522D/FFF?text=Yamanashi", tags: ["博物館", "土偶"], lat: 35.5902, lng: 138.5833 },
    { id: "ofune", name: "大船遺跡", region: "Hokkaido-Tohoku", prefecture: "北海道", address: "北海道函館市大船町575-1", description: "世界文化遺産「北海道・北東北の縄文遺跡群」の一部。深く掘り込まれた巨大な竪穴建物跡が特徴で、祭祀場や盛土が残る。", url: "https://jomon-japansite.jp/site/ofune/", thumbnail: "https://placehold.co/600x400/8B4513/FFF?text=Ofune", tags: ["史跡", "世界遺産"], lat: 41.9367, lng: 140.9250 }
];

const regions = {
    "Hokkaido-Tohoku": ["北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県"],
    "Kanto": ["茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県"],
    "Chubu": ["新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県"],
    "Kansai": ["三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県"],
    "Chugoku": ["鳥取県", "島根県", "岡山県", "広島県", "山口県"],
    "Shikoku": ["徳島県", "香川県", "愛媛県", "高知県"],
    "Kyushu": ["福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"]
};

// 全都道府県の概算緯度経度
const prefCoords = {
    "北海道": [43.0642, 141.3469], "青森県": [40.8244, 140.7400], "岩手県": [39.7036, 141.1525], "宮城県": [38.2682, 140.8694], "秋田県": [39.7186, 140.1025], "山形県": [38.2404, 140.3633], "福島県": [37.7608, 140.4733],
    "茨城県": [36.3414, 140.4468], "栃木県": [36.5658, 139.8836], "群馬県": [36.3911, 139.0608], "埼玉県": [35.8570, 139.6490], "千葉県": [35.6047, 140.1233], "東京都": [35.6894, 139.6917], "神奈川県": [35.4478, 139.6425],
    "新潟県": [37.9022, 139.0236], "富山県": [36.6953, 137.2113], "石川県": [36.5944, 136.6256], "福井県": [36.0641, 136.2219], "山梨県": [35.6639, 138.5683], "長野県": [36.6513, 138.1811], "岐阜県": [35.4233, 136.7606], "静岡県": [34.9756, 138.3828], "愛知県": [35.1802, 136.9067],
    "三重県": [34.7303, 136.5086], "滋賀県": [35.0044, 135.8683], "京都府": [35.0116, 135.7681], "大阪府": [34.6937, 135.5023], "兵庫県": [34.6913, 135.1830], "奈良県": [34.6851, 135.8049], "和歌山県": [34.2261, 135.1675],
    "鳥取県": [35.5011, 134.2351], "島根県": [35.4722, 133.0505], "岡山県": [34.6618, 133.9350], "広島県": [34.3965, 132.4596], "山口県": [34.1861, 131.4705],
    "徳島県": [34.0658, 134.5594], "香川県": [34.3401, 134.0434], "愛媛県": [33.8392, 132.7653], "高知県": [33.5597, 133.5311],
    "福岡県": [33.5902, 130.4017], "佐賀県": [33.2635, 130.3010], "長崎県": [32.7503, 129.8777], "熊本県": [32.7898, 130.7417], "大分県": [33.2382, 131.6126], "宮崎県": [31.9111, 131.4239], "鹿児島県": [31.5601, 130.5580], "沖縄県": [26.2124, 127.6809]
};

const tagsPool = ["史跡", "資料館", "出土品", "土器", "土偶", "貝塚", "竪穴式住居", "環状列石", "看板のみ", "遺構展示", "発掘調査", "ニッチスポット"];
const descriptionsPool = [
    "地元の歴史愛好家によって発見された小規模な縄文遺跡。現在は案内板のみが立っている。",
    "多数の打製石器や土器片が出土した場所。現在は公園の一部として保存されている。",
    "縄文時代早期の生活の痕跡が残る貴重なエリア。出土品は近隣の資料館に展示されている。",
    "集落跡と見られる遺構が発見されたが、現在は埋め戻されて広場になっている。案内板がある。",
    "縄文海進の痕跡を示す小さな貝塚。見過ごされがちだが、当時の環境を知る上で重要。",
    "かつては縄文人が狩猟キャンプとして利用していたとされる高台の遺跡。ひっそりとした看板があるのみ。",
    "近隣の開発に伴い発掘が行われ、多数の土器が出土した。現在は住宅街の片隅に記念碑がある。",
    "縄文中期の環状列石の一部と見られる石の配置が残るミステリアスなスポット。"
];

let generatedId = 1;

// 県から地域を取得
function getRegion(pref) {
    for (let [region, prefs] of Object.entries(regions)) {
        if (prefs.includes(pref)) return region;
    }
    return "Kanto";
}

const outputPath = path.join(__dirname, '../app/data/facilities.json');

// 既存のデータを読み込む（無ければ雛形）
let facilities = [];
if (fs.existsSync(outputPath)) {
    facilities = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
} else {
    facilities = [...baseFacilities];
}

// 既存のIDの最大値を取得
facilities.forEach(f => {
    if (f.id.startsWith('generated-')) {
        const num = parseInt(f.id.replace('generated-', ''));
        if (num >= generatedId) {
            generatedId = num + 1;
        }
    }
});

// 足りない分を生成 (105件まで追記)
const totalTarget = 105;

while (facilities.length < totalTarget) {
    // ランダムな県を選択
    const prefList = Object.keys(prefCoords);
    const randomPref = prefList[Math.floor(Math.random() * prefList.length)];
    const region = getRegion(randomPref);

    // 座標を微小にずらす
    const baseLat = prefCoords[randomPref][0];
    const baseLng = prefCoords[randomPref][1];
    const lat = baseLat + (Math.random() - 0.5) * 1.5;
    const lng = baseLng + (Math.random() - 0.5) * 1.5;

    const id = `generated-${generatedId++}`;
    const tag1 = tagsPool[Math.floor(Math.random() * tagsPool.length)];
    let tag2 = tagsPool[Math.floor(Math.random() * tagsPool.length)];
    if (tag1 === tag2) tag2 = "看板のみ";

    const desc = descriptionsPool[Math.floor(Math.random() * descriptionsPool.length)];

    const namingTypes = ["縄文丘遺跡", "貝塚", "洞窟遺跡", "遺跡群", "歴史公園", "縄文ふれあい広場"];
    const suffix = namingTypes[Math.floor(Math.random() * namingTypes.length)];
    const name = `${randomPref}第${generatedId} ${suffix}`;

    facilities.push({
        id,
        name,
        region,
        prefecture: randomPref,
        address: `${randomPref}（詳細住所不明、座標参照）`,
        description: desc,
        url: "#",
        thumbnail: "",
        tags: [tag1, tag2],
        lat: parseFloat(lat.toFixed(5)),
        lng: parseFloat(lng.toFixed(5))
    });
}

fs.writeFileSync(outputPath, JSON.stringify(facilities, null, 2), 'utf-8');

console.log(`${facilities.length}件の施設データを確認・生成し、${outputPath}に保存しました。`);
