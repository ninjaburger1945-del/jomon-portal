/**
 * 全施設の copy（最大20文字キャッチコピー）と
 * access（train/bus/car/rank）を Gemini で生成して facilities.json に書き込む
 *
 * Usage: GEMINI_API_KEY=xxx node scripts/regenerate-copy-and-access.js
 */

const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY が未設定です');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const facilitiesPath = path.join(__dirname, '../app/data/facilities.json');
const data = JSON.parse(fs.readFileSync(facilitiesPath, 'utf-8'));

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function generateForFacility(facility) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `
あなたは日本の縄文時代遺跡の専門家です。
以下の施設情報をもとに、JSONのみを返してください（コードブロック不要）。

施設名: ${facility.name}
住所: ${facility.address}
説明: ${facility.description}

出力するJSONフィールド:
1. "copy": 施設の最大の特徴を表す日本語キャッチコピー。**厳密に20文字以内**。体言止め推奨。句読点なし。
2. "access": 以下の形式で実際のアクセス情報を作成。正確な地名・路線名・IC名を使うこと。
   - "train": 最寄り鉄道駅名（路線名付き）から施設まで。例「JR奥羽本線青森駅からバスで約35分」
   - "bus": 最寄りバス停名から施設まで（バス停名を必ず含める）。例「縄文時遊館前バス停から徒歩約2分」
   - "car": 最寄りIC名（高速道路名付き）から施設まで。例「東北道青森ICから国道7号経由で約15分」
   - "rank": アクセスの容易さ。S=駅・バス停から徒歩圏、A=乗り換え1回程度、B=バスや車が必要、C=車必須

出力例:
{"copy":"縄文最大集落の記憶","access":{"train":"JR奥羽本線青森駅からバスで約35分","bus":"縄文時遊館前バス停から徒歩約2分","car":"東北道青森ICから国道7号経由で約15分","rank":"B"}}
`.trim();

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  // JSONブロックを除去して parse
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  const parsed = JSON.parse(cleaned);

  // copy が 20文字を超えていたらトリム
  if (parsed.copy && parsed.copy.length > 20) {
    parsed.copy = parsed.copy.substring(0, 20);
  }

  return parsed;
}

async function main() {
  console.log(`${data.length} 件の施設を処理します\n`);

  const updated = [];

  for (let i = 0; i < data.length; i++) {
    const facility = data[i];
    process.stdout.write(`[${i + 1}/${data.length}] ${facility.name} ... `);

    try {
      const generated = await generateForFacility(facility);

      const newFacility = {
        ...facility,
        copy: generated.copy,
        access: {
          train: generated.access.train || '',
          bus:   generated.access.bus   || '',
          car:   generated.access.car   || '',
          rank:  generated.access.rank  || facility.access?.rank || 'B',
        },
      };
      // advice フィールドを削除（存在する場合）
      delete newFacility.access.advice;
      delete newFacility.access.info;

      updated.push(newFacility);
      console.log(`✅ copy="${generated.copy}" rank=${generated.access.rank}`);
    } catch (err) {
      console.error(`❌ エラー: ${err.message}`);
      // エラー時は元データを保持（advice除去のみ）
      const fallback = { ...facility };
      if (fallback.access) {
        delete fallback.access.advice;
        if (!fallback.access.train) {
          fallback.access.train = fallback.access.info || '';
          fallback.access.bus = '';
          fallback.access.car = '';
          delete fallback.access.info;
        }
      }
      updated.push(fallback);
    }

    // レート制限対策
    if (i < data.length - 1) await sleep(1200);
  }

  fs.writeFileSync(facilitiesPath, JSON.stringify(updated, null, 2) + '\n');
  console.log(`\n✅ facilities.json を更新しました`);
}

main().catch(console.error);
