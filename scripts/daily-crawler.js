const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

// 観光トップページ・浅い階層へのリダイレクト検知パターン
const REDIRECT_TRAP_PATTERNS = [
  /\/kanko\/?(\?.*)?$/i,
  /\/kankou\/?(\?.*)?$/i,
  /\/tourism\/?(\?.*)?$/i,
  /\/sightseeing\/?(\?.*)?$/i,
  /\/spot\/?(\?.*)?$/i,
];

// 自治体・政府系ドメインかどうかを判定
// 施設専用ドメイン（museum.jp 等）のトップURLは正当なので除外しない
function isGovernmentDomain(url) {
  return /\.(lg|go)\.jp/i.test(url) ||
    /^https?:\/\/(?:www\.)?(?:city|town|village|machi|mura)\.[^.]+\.[^.]+\.jp/i.test(url) ||
    /\.pref\.[^.]+\.jp/i.test(url);
}

// 自治体ドメインのみに適用するリダイレクトトラップ（ドメイントップ・浅い階層）
const GOVERNMENT_REDIRECT_TRAP_PATTERNS = [
  // ドメイントップ（パスなし）
  /^https?:\/\/[^/]+\/?(\?.*)?$/,
  // 浅い1階層（/xxx/ のみ）
  /^https?:\/\/[^/]+\/[^/]+\/?(\?.*)?$/,
];

// ページ死亡検知パターン
const DEAD_PAGE_PATTERNS = [
  /404 Not Found/i,
  /ページが見つかりません/,
  /このページは存在しません/,
  /お探しのページ.*ありません/,
  /ページは移動または削除/,
  /削除されました/,
  /<title[^>]*>.*404.*<\/title>/i,
];

/**
 * 厳格URLバリデーション
 * - リダイレクト先が観光トップ等なら失敗
 * - ページに「404」「存在しません」等があれば失敗
 * - <title>/<h1> に施設名キーワードが含まれない場合は失敗
 * @returns {{ valid: boolean, url: string, verified: boolean }}
 */
async function validateUrlStrict(url, facilityName) {
  if (!url || !url.startsWith("http")) {
    console.warn(`[URL_SKIP] URLなし: スキップ`);
    return { valid: false, url: "", verified: false };
  }

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
    };

    const res = await fetch(url, {
      method: 'GET',
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    });

    const finalUrl = res.url || url;

    // リダイレクトトラップ検知（観光ページ系は全ドメイン対象）
    for (const pattern of REDIRECT_TRAP_PATTERNS) {
      if (pattern.test(finalUrl)) {
        console.warn(`[REDIRECT_TRAP] ${url} → ${finalUrl}`);
        return { valid: false, url: "", verified: false };
      }
    }
    // ドメイントップ・浅い階層チェックは自治体ドメインのみに適用
    // 施設専用ドメイン（tokamachi-museum.jp 等）はトップURLが公式サイトのため除外しない
    if (isGovernmentDomain(finalUrl)) {
      for (const pattern of GOVERNMENT_REDIRECT_TRAP_PATTERNS) {
        if (pattern.test(finalUrl)) {
          console.warn(`[REDIRECT_TRAP] 自治体ドメインのトップ/浅い階層: ${url} → ${finalUrl}`);
          return { valid: false, url: "", verified: false };
        }
      }
    }

    // HTTPエラー（403/405は許容）
    if (!res.ok && res.status !== 403 && res.status !== 405) {
      console.warn(`[HTTP_${res.status}] ${url}`);
      return { valid: false, url: "", verified: false };
    }

    // ページ内容取得（最大150KB）
    let html = "";
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      html = new TextDecoder('utf-8').decode(buffer.slice(0, 150000));
    }

    // 死亡ページ検知
    for (const pattern of DEAD_PAGE_PATTERNS) {
      if (pattern.test(html)) {
        console.warn(`[DEAD_PAGE] ${url} マッチ: ${pattern}`);
        return { valid: false, url: "", verified: false };
      }
    }

    // タイトル一致確認: <title> or <h1> に施設名のキーワードが含まれるか
    if (html && facilityName) {
      const keyword = facilityName
        .replace(/^(特別|国|県|市|町|村)(指定)?(史跡|遺跡)?\s*/g, '')
        .replace(/^(特別史跡|史跡|遺跡群|縄文遺跡)\s*/g, '')
        .replace(/(遺跡|貝塚|遺跡群|縄文遺跡|縄文館|博物館|資料館|記念館|センター|公園|学習館)$/, '')
        .trim()
        .split(/[\s　]/)[0];

      if (keyword.length >= 2) {
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        const titleText = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '') : '';
        const h1Text = h1Match ? h1Match[1].replace(/<[^>]+>/g, '') : '';
        const pageText = titleText + ' ' + h1Text;

        if (!pageText.includes(keyword)) {
          console.warn(`[TITLE_MISMATCH] キーワード「${keyword}」が title/h1 に見つからず: ${url}`);
          console.warn(`  title: "${titleText.substring(0, 80)}" | h1: "${h1Text.substring(0, 80)}"`);
          return { valid: false, url: "", verified: false };
        }
      }
    }

    // .lg.jp / .go.jp、または city/town/village.xxx.pref.jp（旧来の自治体形式）は verified=true
    const verified = /\.(lg|go)\.jp/i.test(finalUrl) ||
      /^https?:\/\/(?:www\.)?(?:city|town|village|machi|mura)\.[^.]+\.[^.]+\.jp/i.test(finalUrl);
    console.log(`[VALID] ${finalUrl}${verified ? ' ✓ (公式自治体)' : ''}`);
    return { valid: true, url: finalUrl, verified };

  } catch (e) {
    console.warn(`[FETCH_ERROR] ${url}: ${e.message}`);
    return { valid: false, url: "", verified: false };
  }
}

/**
 * URL検証失敗時のフォールバック: Gemini Google Search で正しいURLを再検索
 * @returns {Promise<{valid: boolean, url: string, verified: boolean}>}
 */
async function searchAlternativeUrl(model, facilityName, prefecture) {
  console.log(`[URL_SEARCH] "${facilityName}" の公式URLをGeminiで再検索中...`);
  try {
    const searchPrompt = `
Google検索を使って、「${facilityName}」（${prefecture}）の公式ウェブサイトのURLを1つだけ見つけてください。

条件:
- 施設の公式サイト（自治体 .lg.jp 形式、または city.xxx.pref.jp 旧形式、または施設独自ドメイン）
- トップページや観光ページ（/kanko/ 等）ではなく、施設名が直接掲載されているページ
- 必ず実在するURLのみ

URLだけを1行で出力してください。見つからない場合は「なし」と出力してください。
`;
    const result = await model.generateContent(searchPrompt);
    const text = result.response.text().trim();

    if (!text || text === 'なし' || !text.startsWith('http')) {
      console.warn(`[URL_SEARCH] 再検索結果なし`);
      return { valid: false, url: "", verified: false };
    }

    // URLだけ抽出（余分なテキストが付いている場合に対応）
    const urlMatch = text.match(/https?:\/\/[^\s\n]+/);
    if (!urlMatch) {
      console.warn(`[URL_SEARCH] URLを抽出できませんでした: ${text}`);
      return { valid: false, url: "", verified: false };
    }

    const candidateUrl = urlMatch[0].replace(/[。、」）\]>]+$/, ''); // 末尾の日本語記号を除去
    console.log(`[URL_SEARCH] 再検索結果: ${candidateUrl}`);
    return await validateUrlStrict(candidateUrl, facilityName);

  } catch (e) {
    console.warn(`[URL_SEARCH] 再検索エラー: ${e.message}`);
    return { valid: false, url: "", verified: false };
  }
}

async function run() {
  try {
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is missing");

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-pro",
      tools: [{ googleSearch: {} }],
    });

    const filePath = path.join(__dirname, "../app/data/facilities.json");
    let existingData = [];
    if (fs.existsSync(filePath)) {
      existingData = JSON.parse(fs.readFileSync(filePath, "utf-8") || "[]");
    }

    const existingNames = existingData.map(d => d.name).join(", ");
    const regions = ["北海道", "東北", "関東", "中部", "近畿", "中国", "四国", "九州", "沖縄"];
    const randomRegion = regions[Math.floor(Math.random() * regions.length)];

    const prompt = `
あなたは日本の縄文時代における遺跡・貝塚・環状列石などの専門リサーチャーです。
以下の「すでに登録済みの施設リスト」に含まれていない、**日本国内の重要な縄文時代の遺跡・博物館・資料館**を **必ず3件** ピックアップし、JSON配列で出力してください。
（URLが存在しない場合のバックアップとして3件必要です。必ず3件出力してください。）

【既存リスト（これらは除外してください）】
${existingNames}

【条件】
ターゲット地方: 【${randomRegion}地方】
世界遺産ではない、その土地ならではの遺跡を探してください。

【URL取得に関する最重要指示】
- Google検索機能を使って、施設の **自治体ウェブサイトの深い階層のURL** を最優先で探してください
  例（新形式）: https://www.city.xxx.lg.jp/shisei/bunka/iseki/xxxx.html
  例（旧形式）: https://www.city.xxx.saitama.jp/kyoiku/bunkazai/xxx/index.html
  ※ 日本の自治体ドメインは「.lg.jp」形式と「city.xxx.pref.jp」形式の両方があります。両方を検索してください。
- 観光トップページ（/kanko/, /tourism/ 等）や、ドメイントップ（https://xxx.lg.jp/）は不可
- 必ず施設名そのものが<title>や<h1>に含まれるページのURLを選んでください
- 自治体サイトが見つからない場合は .go.jp、次に公的観光協会サイトを検討してください
- どうしても見つからない場合は空文字（""）にしてください

【出力要件】
1. 完全なJSON配列（\`[{...}]\`）のみを出力してください。マークダウンのバッククォート不要です。
2. データ構造は以下の通り（3件分）:
{
  "id": "英数字のハイフン繋ぎ（例: uenohara-jomon）",
  "name": "施設の正式名称",
  "region": "Hokkaido / Tohoku / Kanto / Chubu / Kinki / Chugoku / Shikoku / Kyushu / Okinawa のいずれか",
  "prefecture": "都道府県名",
  "address": "住所",
  "description": "200文字程度の魅力的な紹介文",
  "copy": "施設の最大の特徴を表すキャッチコピー。厳密に14文字以内。体言止め推奨。句読点なし。",
  "url": "自治体(.lg.jp)の深い階層URLを優先。見つからなければ空文字",
  "thumbnail": "",
  "tags": ["世界遺産","博物館","貝塚","環状列石","土器","土偶","国宝" の中から最大2個のみ],
  "lat": 緯度(数値),
  "lng": 経度(数値),
  "access": {
    "train": "最寄り鉄道駅名（路線名付き）から施設まで。例: JR奥羽本線青森駅からバスで約35分",
    "bus": "最寄りバス停名から施設まで（バス停名を必ず含める）。例: 縄文時遊館前バス停から徒歩約2分",
    "car": "最寄りIC名（高速道路名付き）から施設まで。例: 東北道青森ICから国道7号経由で約15分",
    "rank": "S（駅徒歩圏） / A（乗り換え1回程度） / B（バス・車が必要） / C（車必須） のいずれか"
  }
}
3. urlは 'http' から始まるURL形式、または空文字にしてください。
4. thumbnail は空文字（""）にしてください。
`;

    console.log(`[CRAWLER] Gemini AI にリクエスト (地方: ${randomRegion})...`);
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    let jsonStr = responseText.trim();
    if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
    if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
    if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
    jsonStr = jsonStr.trim();

    const candidates = JSON.parse(jsonStr);
    if (!Array.isArray(candidates) || candidates.length === 0) {
      throw new Error("AI が有効な配列を返しませんでした。");
    }

    console.log(`[CRAWLER] AI が ${candidates.length} 件の候補を返却。1件通過するまで順番に検証...`);

    let addedCount = 0;
    for (const nf of candidates) {
      // 1件制限
      if (addedCount >= 1) {
        console.log(`[LIMIT] 1件制限: 残りの候補をスキップ`);
        break;
      }

      // 重複チェック
      const isDuplicate = existingData.some(f =>
        f.id === nf.id || f.name.includes(nf.name) || nf.name.includes(f.name)
      );
      if (isDuplicate) {
        console.log(`[DUPLICATE] スキップ: ${nf.name}`);
        continue;
      }

      // 厳格URLバリデーション → 失敗時はGeminiで再検索 → それでも失敗なら url=""
      console.log(`[VALIDATE] ${nf.name}: ${nf.url}`);
      let validation = await validateUrlStrict(nf.url, nf.name);
      if (!validation.valid) {
        console.warn(`[URL_WARN] 初回URL失敗。Geminiで代替URLを再検索します...`);
        validation = await searchAlternativeUrl(model, nf.name, nf.prefecture);
      }
      if (!validation.valid) {
        console.warn(`[URL_WARN] ${nf.name}: 再検索も失敗。url="" で追加します。`);
        nf.url = "";
        nf.verified = false;
      } else {
        nf.url = validation.url;
        nf.verified = validation.verified;
      }

      // 既存AIイメージをランダムコピー
      try {
        const imagesDir = path.join(__dirname, '../public/images/facilities');
        const files = fs.readdirSync(imagesDir);
        const aiImages = files.filter(f => f.endsWith('_ai.png'));
        if (aiImages.length > 0) {
          const randomImage = aiImages[Math.floor(Math.random() * aiImages.length)];
          const targetFileName = `${nf.id}_ai.png`;
          fs.copyFileSync(
            path.join(imagesDir, randomImage),
            path.join(imagesDir, targetFileName)
          );
          nf.thumbnail = `/images/facilities/${targetFileName}`;
          console.log(`[IMAGE] ${randomImage} → ${targetFileName}`);
        } else {
          nf.thumbnail = "";
        }
      } catch (imgErr) {
        console.error(`[IMAGE_ERROR] ${imgErr.message}`);
        nf.thumbnail = "";
      }

      existingData.push(nf);
      addedCount++;
      console.log(`[ADDED] ${nf.name} | verified: ${nf.verified} | url: ${nf.url}`);
    }

    if (addedCount === 0) {
      console.warn('[RESULT] 本日は新規施設を追加できませんでした（全候補が検証失敗または重複）。');
      process.exit(0);
    }

    fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));
    console.log(`[RESULT] 合計 ${existingData.length} 件`);
    console.log('[CRAWLER] 完了。');

  } catch (error) {
    console.error("[FATAL]", error.message);
    process.exit(1);
  }
}

run();
