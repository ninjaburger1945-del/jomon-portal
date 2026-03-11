const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../app/data/facilities.json');
let data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

const updates = {
  "sannaimaruyama": { "info": "運転免許センターから徒歩約26分。", "advice": "駅からちょっと遠いから、バスかレンタカーで行くのがおすすめだよ！" },
  "togariishi": { "info": "茅野市営茅野駅東口自動パーキングから徒歩約99分。", "advice": "ここは歩いて行くのは無謀だよ〜！絶対レンタカーかタクシーを使ってね！" },
  "kasori": { "info": "小倉台駅から徒歩約14分。", "advice": "駅から歩いて行ける距離だよ！お散歩気分で行ってみよう！" },
  "korekawa": { "info": "八戸中心街ターミナルから徒歩約52分。", "advice": "駅から歩くとかなり遠いよ！バスか車で行くのがおすすめ！" },
  "idojiri": { "info": "信濃境駅から徒歩約19分。", "advice": "駅から歩いて20分弱かな！歩ける距離だけど、車があるともっと楽ちんだよ！" },
  "jomon-museum": { "info": "気山駅から徒歩約2分。", "advice": "駅から歩いてすぐだよ！アクセス抜群で最高だね！" },
  "umaikata": { "info": "道の駅ながおか花火館から徒歩約26分。", "advice": "ここは歩くとちょっと遠いよ！できれば車かタクシーで行くのがいいかな！" },
  "uenohara": { "info": "ローソン 国分駅前店から徒歩約89分。", "advice": "ひえ〜！ここは歩いて行くのは厳しいよ！レンタカーを借りて行こう！" },
  "maibun": { "info": "道の駅とよとみ 与一味工房から徒歩約58分。", "advice": "予想以上に遠いから、車やタクシーを使うのが無難だよ！" },
  "ofune": { "info": "道の駅 縄文ロマン 南かやべから徒歩約28分。", "advice": "歩くと30分くらいかかるよ！車で行くのがおすすめ！" },
  "oyu": { "info": "十和田南駅から徒歩約49分。", "advice": "駅から離れているから、車かタクシーで行くのがいいと思うよ！" },
  "isedotai": { "info": "大野台駅から徒歩約11分。", "advice": "駅から歩いて10分ちょっとだよ！これなら電車でも行きやすいね！" },
  "komakino": { "info": "筒井駅から徒歩約124分。", "advice": "徒歩だと2時間以上かかっちゃう！絶対に車かタクシーを使ってね！" },
  "kamegaoka": { "info": "川倉駅から徒歩約205分。", "advice": "駅から遠すぎるよ〜！ここは絶対にレンタカーが必要だね！" },
  "kitakogane": { "info": "黄金駅から徒歩約39分。", "advice": "歩けない距離じゃないけど、ちょっと遠いかな！車があるなら車がおすすめ！" },
  "kakinoshima": { "info": "函館市縄文文化交流センターから徒歩約5分。", "advice": "センターのすぐそばだよ！アクセスしやすくて助かるね！" },
  "irie-takasago": { "info": "洞爺駅から徒歩約11分。", "advice": "駅から歩いてすぐだよ！電車で行くのにぴったりの遺跡だね！" },
  "goshono": { "info": "一戸駅から徒歩約36分。", "advice": "駅からちょっと歩くよ！バスがあるか調べてみてもいいかも。でも基本は車がおすすめ！" },
  "hiraide": { "info": "旧塩尻駅跡から徒歩約34分。", "advice": "歩くと30分以上かかるよ！体力に自信がないなら車かタクシーを使おう！" },
  "oomori": { "info": "大森駅から徒歩約3分。", "advice": "さすが都会！駅からすぐだよ！電車でピューっと行ってみよう！" },
  "hoshigato": { "info": "下諏訪駅から徒歩約111分。", "advice": "ここは歩いて行くのは無謀だよ！レンタカーを借りて向かおう！" },
  "yoshigo": { "info": "神戸駅から徒歩約43分。", "advice": "歩くとそこそこ遠いよ！車で行く方が断然ラクチンだよ！" },
  "torihama": { "info": "三方駅から徒歩約22分。", "advice": "駅から歩いて歩けないことはない距離だよ！お散歩がてら行ってみるのもアリかも？" },
  "tsugumo": { "info": "道の駅 笠岡ベイファームから徒歩約55分。", "advice": "ここは歩くとかなり遠いよ！車かタクシーを使うのがおすすめ！" },
  "kamikuroiwa": { "info": "道の駅 みかわから徒歩約72分。", "advice": "ちょっとアクセスが大変な場所だよ！絶対に車で行ってね！" },
  "satohama": { "info": "東名駅から徒歩約79分。", "advice": "うーん、ここは歩いて行くのは厳しいかな！車で行く計画を立てよう！" },
  "aku": { "info": "青柳駅から徒歩約125分。", "advice": "ちょっと秘境かも！？絶対に車かタクシーで行ってね！" },
  "ubayama": { "info": "市川大野駅から徒歩約16分。", "advice": "駅から15分くらい歩くよ！全然歩ける距離だからお散歩気分で行こう！" },
  "soyata": { "info": "道の駅いちかわから徒歩約24分。", "advice": "駅から20分ちょっと歩くかな。バスを使うのもアリだよ！" },
  "nabatake": { "info": "唐津駅南駐車場から徒歩約15分。", "advice": "駅から歩いて15分！アクセスしやすい遺跡だね！" },
  "jomon-culture-center": { "info": "函館市縄文文化交流センターから徒歩約1分。", "advice": "もう目の前だよ！すぐ着いちゃうね！" },
  "jomopia-miyahata": { "info": "瀬上駅から徒歩約27分。", "advice": "駅からちょっと歩くかな！車で行くのがラクチンかも！" },
  "mawaki-jomon": { "info": "縄文真脇駅跡から徒歩約4分。", "advice": "駅から歩いてすぐだよ！アクセス抜群で嬉しいな！" },
  "tobinodai-museum": { "info": "新船橋駅から徒歩約10分。", "advice": "駅から歩いて10分！電車で行くのにぴったりの博物館だよ！" },
  "mizuko-kaizuka": { "info": "みずほ台駅から徒歩約21分。", "advice": "駅から歩いて20分くらいだよ！車があるともっと楽かも！" }
};

let count = 0;
data.forEach(facility => {
    if (updates[facility.id]) {
        facility.access.info = updates[facility.id].info;
        facility.access.advice = updates[facility.id].advice;
        count++;
    }
});

fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
console.log(`Updated ${count} facilities.`);
