const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

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
        .replace(/[（(][\s\S]*$/, '')  // 括弧以降（補足説明）を除去
        .replace(/^(特別|国|県|市|町|村)(指定)?(史跡|遺跡)?\s*/g, '')
        .replace(/^(特別史跡|史跡|遺跡群|縄文遺跡)\s*/g, '')
        .replace(/^[\u3000-\u9fff]{1,8}?[市区町村]\s*/, '')  // 先頭の地名（〇〇市等）を除去
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

    // .lg.jp / .go.jp、または city/town/village.xxx.pref.jp（旧来・サブドメイン形式含む）は verified=true
    // museum.city.nagaoka.niigata.jp のようなサブドメイン形式にも対応
    const verified = /\.(lg|go)\.jp/i.test(finalUrl) ||
      /^https?:\/\/(?:[^./]+\.)*(?:city|town|village|machi|mura)\.[^.]+\.[^.]+\.jp/i.test(finalUrl);
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

/**
 * Gemini に施設の説明文を読ませて Imagen 用英語プロンプトを生成する
 */
async function buildImagePromptFromDescription(model, facility) {
  const promptRequest = `
以下の縄文遺跡・施設の情報をもとに、AIイラスト生成（Imagen）用の英語プロンプトを1つ作成してください。

施設名: ${facility.name}
都道府県: ${facility.prefecture}
説明文: ${facility.description}
タグ: ${(facility.tags || []).join(', ')}

【プロンプト作成のルール】
- 説明文の内容（遺跡の特徴・時代・出土品・景観など）を具体的に反映すること
- 縄文時代の建物は必ず「竪穴式住居（semi-subterranean pit dwelling with very thick thatched roof reaching nearly to the ground, round shape, no vertical walls）」で描写すること
- 風景画・遺跡の景観イメージとして自然・空・光を含めること
- 末尾に必ず以下を追加: photorealistic cinematic landscape painting, wide panoramic composition, NO black borders, NO letterboxing, full bleed edge-to-edge image
- 英語のみ・1行・300文字以内で出力すること。余計な説明は不要。
`;
  try {
    const result = await model.generateContent(promptRequest);
    const text = result.response.text().trim().replace(/\n/g, ' ');
    console.log(`[IMAGE_GEN] 生成プロンプト: ${text.substring(0, 120)}...`);
    return text;
  } catch (e) {
    console.warn(`[IMAGE_GEN] プロンプト生成失敗: ${e.message}`);
    return null;
  }
}

/**
 * 施設情報をもとに Imagen でイラストを生成して保存する
 * 最大3回リトライし、全て失敗した場合は false を返す
 * @returns {Promise<boolean>}
 */
async function generateFacilityImage(apiKey, model, facility, outputPath) {
  if (!apiKey) return false;

  // Gemini に説明文を読ませて英語プロンプトを生成
  const prompt = await buildImagePromptFromDescription(model, facility);
  if (!prompt) return false;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`;
  const body = {
    instances: [{ prompt }],
    parameters: { sampleCount: 1, aspectRatio: '16:9' },
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[IMAGE_GEN] Imagen生成試行 ${attempt}/3: ${facility.name}`);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[IMAGE_GEN] HTTP ${res.status}: ${errText.substring(0, 120)}`);
        if (attempt < 3) await new Promise(r => setTimeout(r, 5000 * attempt));
        continue;
      }
      const json = await res.json();
      const b64 = json?.predictions?.[0]?.bytesBase64Encoded;
      if (!b64) {
        console.warn(`[IMAGE_GEN] レスポンスに画像データなし`);
        if (attempt < 3) await new Promise(r => setTimeout(r, 5000 * attempt));
        continue;
      }
      fs.writeFileSync(outputPath, Buffer.from(b64, 'base64'));
      return true;
    } catch (e) {
      console.warn(`[IMAGE_GEN] 試行${attempt}失敗: ${e.message}`);
      if (attempt < 3) await new Promise(r => setTimeout(r, 5000 * attempt));
    }
  }
  console.warn(`[IMAGE_GEN] 3回失敗。ランダムコピーにフォールバックします。`);
  return false;
}

async function run() {
  try {
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is missing");

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-pro",
      tools: [{ googleSearch: {} }],
    });

    // 確実なパスを設定（repo root を基準）
    const repoRoot = path.resolve(__dirname, "..");
    const filePath = path.join(repoRoot, "app/data/facilities.json");

    console.log(`[CRAWLER] Loading from: ${filePath}`);

    let existingData = [];
    if (fs.existsSync(filePath)) {
      existingData = JSON.parse(fs.readFileSync(filePath, "utf-8") || "[]");
      console.log(`[CRAWLER] Loaded ${existingData.length} existing facilities`);
    } else {
      console.error(`[CRAWLER] ERROR: File not found at ${filePath}`);
      process.exit(1);
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
  "description": "200文字以上300文字程度の魅力的な紹介文",
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

      // description 文字数バリデーション（200文字以上必須）
      const descCharCount = (nf.description || "").length;
      if (descCharCount < 200) {
        console.warn(`[DESC_WARN] ${nf.name}: ${descCharCount}文字。200文字以上300文字への拡充を要求します...`);
        // Gemini に description を拡充させる
        const expandPrompt = `以下の縄文遺跡の説明文を、200文字以上300文字程度の読み応えのある内容に拡充してください。元の情報は保持しつつ、歴史的価値や考古学的意義を補完してください。

施設名: ${nf.name}
都道府県: ${nf.prefecture}
住所: ${nf.address}
現在の説明文: ${nf.description}
タグ: ${(nf.tags || []).join(', ')}

**要件:**
- 200文字以上300文字程度
- 原情報を保持
- 歴史的価値・魅力を補完
- 日本語として自然な表現

拡充後の説明文のみを出力してください。`;
        try {
          const expandResult = await model.generateContent(expandPrompt);
          const expandedDesc = expandResult.response.text().trim();
          if (expandedDesc.length >= 200) {
            nf.description = expandedDesc;
            console.log(`[DESC_EXPAND] 拡充成功: ${expandedDesc.length}文字`);
          } else {
            console.warn(`[DESC_EXPAND] 拡充失敗: ${expandedDesc.length}文字に留まりました。手動対応が必要です。`);
          }
        } catch (descErr) {
          console.error(`[DESC_ERROR] ${descErr.message}`);
        }
      }

      // AIイメージ生成（Imagen API → 失敗時はランダムコピーにフォールバック）
      {
        const imagesDir = path.join(__dirname, '../public/images/facilities');
        const targetFileName = `${nf.id}_ai.png`;
        const targetPath = path.join(imagesDir, targetFileName);
        const generated = await generateFacilityImage(process.env.GEMINI_API_KEY, model, nf, targetPath);
        if (generated) {
          nf.thumbnail = `/images/facilities/${targetFileName}`;
          console.log(`[IMAGE] Imagen生成成功: ${targetFileName}`);
        } else {
          // フォールバック: 既存AIイメージをランダムコピー
          try {
            const files = fs.readdirSync(imagesDir);
            const aiImages = files.filter(f => f.endsWith('_ai.png'));
            if (aiImages.length > 0) {
              const randomImage = aiImages[Math.floor(Math.random() * aiImages.length)];
              fs.copyFileSync(path.join(imagesDir, randomImage), targetPath);
              nf.thumbnail = `/images/facilities/${targetFileName}`;
              console.log(`[IMAGE] フォールバック: ${randomImage} → ${targetFileName}`);
            } else {
              nf.thumbnail = "";
            }
          } catch (imgErr) {
            console.error(`[IMAGE_ERROR] ${imgErr.message}`);
            nf.thumbnail = "";
          }
        }
      }

      // 既存の編集フィールドを保持してマージ
      const existingFacility = existingData.find(f => f.id === nf.id);
      if (existingFacility) {
        // 既存データがある場合は部分更新（管理画面で編集されたフィールドを保持）
        nf = Object.assign({}, existingFacility, nf, {
          // 英語フィールド（管理画面で編集）
          name_en: existingFacility.name_en || nf.name_en || "",
          description_en: existingFacility.description_en || nf.description_en || "",
          location_en: existingFacility.location_en || nf.location_en || "",
          address_en: existingFacility.address_en || nf.address_en || "",
          // アクセス情報（管理画面で編集）
          access_public: existingFacility.access_public || nf.access_public || "",
          access_public_en: existingFacility.access_public_en || nf.access_public_en || "",
          access_car: existingFacility.access_car || nf.access_car || "",
          access_car_en: existingFacility.access_car_en || nf.access_car_en || ""
        });
        const idx = existingData.findIndex(f => f.id === nf.id);
        existingData[idx] = nf;
      } else {
        // 新規追加時も全フィールドを初期化
        nf.name_en = nf.name_en || "";
        nf.description_en = nf.description_en || "";
        nf.location_en = nf.location_en || "";
        nf.address_en = nf.address_en || "";
        nf.access_public = nf.access_public || "";
        nf.access_public_en = nf.access_public_en || "";
        nf.access_car = nf.access_car || "";
        nf.access_car_en = nf.access_car_en || "";
        existingData.push(nf);
      }
      addedCount++;
      console.log(`[ADDED] ${nf.name} | verified: ${nf.verified} | url: ${nf.url}`);
    }

    if (addedCount === 0) {
      console.warn('[RESULT] 本日は新規施設を追加できませんでした（全候補が検証失敗または重複）。');
      process.exit(0);
    }

    // 編集フィールド（英語・アクセス情報）を保持したままファイルを保存
    const dataToSave = existingData.map(f => ({
      ...f,
      // 英語フィールド
      name_en: f.name_en || "",
      description_en: f.description_en || "",
      location_en: f.location_en || "",
      address_en: f.address_en || "",
      // アクセス情報
      access_public: f.access_public || "",
      access_public_en: f.access_public_en || "",
      access_car: f.access_car || "",
      access_car_en: f.access_car_en || ""
    }));
    fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));
    console.log(`[RESULT] 合計 ${existingData.length} 件（編集フィールド保護済み）`);
    console.log('[CRAWLER] ファイル保存完了。');

    // Git に自動コミット
    try {
      console.log('[GIT] Git にコミット中...');
      const cwd = repoRoot;

      // facilities.json を add
      execSync('git add app/data/facilities.json', { cwd, stdio: 'pipe' });
      console.log('[GIT] ✓ git add completed');

      // コミット
      const commitMsg = `chore(crawler): add new facility - ${existingData[existingData.length - 1].name}`;
      execSync(`git commit -m "${commitMsg}"`, { cwd, stdio: 'pipe' });
      console.log(`[GIT] ✓ commit: "${commitMsg}"`);

      // push
      execSync('git push origin main', { cwd, stdio: 'pipe' });
      console.log('[GIT] ✓ push completed');
    } catch (gitErr) {
      console.warn('[GIT] ⚠️  Git操作エラー:', gitErr.message);
      console.warn('[GIT] ファイルは保存されていますが、自動pushに失敗しました。');
      console.warn('[GIT] 手動で git add / commit / push してください。');
    }

    console.log('[CRAWLER] 完了。');

  } catch (error) {
    console.error("[FATAL]", error.message);
    process.exit(1);
  }
}

run();
