import { NextResponse, NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as cheerio from 'cheerio';

const JOMON_OS_SUFFIX =
  'Authentic Jomon period Japan, featuring traditional thatched pithouses (Tateana-jukyo) with sunken floors dug into earth, intricate cord-marked pottery (Jomon-doki), gritty prehistoric textures, flickering hearth fire, cinematic natural lighting, raw documentary style, earth colors, 16:9 aspect ratio. Strictly NO Western prehistoric aesthetics. ALL imagery MUST authentically represent Jomon period Japan only.';

export async function POST(request: NextRequest) {
  try {
    const { facilityId, url, description, name, prefecture } = await request.json();

    if (!facilityId || !description) {
      return NextResponse.json(
        { error: 'facilityId and description are required' },
        { status: 400 }
      );
    }

    // Scrape URL with 10 second timeout
    let scrapedText = '';
    if (url) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const fetchRes = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JomonPortalBot/1.0)' },
        });
        clearTimeout(timeoutId);
        if (fetchRes.ok) {
          const html = await fetchRes.text();
          const $ = cheerio.load(html);
          $('script, style, nav, footer, header').remove();
          scrapedText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 3000);
        }
      } catch (scrapeErr) {
        console.warn('[deep-remaster] Scraping failed (non-blocking):', scrapeErr);
      }
    }

    // Gemini API
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const systemPrompt = `あなたは日本の縄文時代（約16,000〜3,000年前）を専門とする考古学ビジュアルディレクターです。
Jomon Portal 専用の『Jomon OS』という統一的な視覚言語で、世界に唯一の考古学的イラストを生成します。

【超重要な制約】
- 出力は必ず JSON のみ: {"concept_a": "...", "concept_b": "...", "concept_c": "..."}
- 各プロンプトは英語で120〜200ワード
- リアリスティック・ドキュメンタリースタイル（アニメ・CG風・ファンタジー禁止）
- EACH CONCEPT MUST OPEN WITH JOMON OS SUFFIX（各プロンプトの冒頭に Jomon OS Suffix を必ず配置）
- Strictly NO Western prehistoric houses, European Stone Age aesthetics, or generic prehistoric imagery
- EXCLUSIVELY JAPANESE JOMON PERIOD AUTHENTICITY

【建築の絶対条件】
Jomon period houses = Sunken-floor pithouses (Tateana-jukyo) のみ
- 構造: Circular or rectangular pit structure dug into the mud earth (地面を掘り下げた構造)
- 屋根: Conical or square thatched roof made of Kaya grass (Miscanthus sinensis) with rough organic texture
  * 決してNOT stone, NOT wooden boards, NOT clay tiles
- 必ず地面から屋根が生えているような形態を強調

【遺物の絶対条件】
- Cord-marked pottery (Jomon-doki) は全3コンセプトに必須
- Flame-style rim decorations (炎炎文) を強調する場合は「Kaen-mon」と指定
- Clay Dogu figurine (土偶) は Concept C で必須、マクロ撮影レベルの極限精細描写
- 古い土器の表面は「ancient patina and earth stains」で質感を追加

【3コンセプトの詳細仕様】

concept_a（Historical Reconstruction - Tateana-jukyo Settlement）:
- 開始: "${JOMON_OS_SUFFIX}"
- Sunken-floor pithouse (Tateana-jukyo) を中心に、複数の集落建物を配置
- Thatched roof made of Kaya grass (Miscanthus sinensis) で屋根を固定
- Cord-marked pottery と cooking hearths を見える位置に配置
- 夜明けか夕暮れのドラマチックな自然光
- 人間活動の痕跡（fire, smoke, daily tools）を生生しく描写

concept_b（Archaeological Site Landscape - Jomon Environment）:
- 開始: "${JOMON_OS_SUFFIX}"
- Sunken-floor pithouse (Tateana-jukyo) を自然風景に統合
- 屋根: Thatched roof of Kaya grass (Miscanthus sinensis) - unchanged
- 施設固有の環境要素を必須で含める (shell mound, lake bottom, obsidian deposits, muddy forest, coastal wetland など)
- Cord-marked pottery fragments が地表に露出している状態
- 自然と人間活動の痕跡が融合した考古学的な「層」を表現

concept_c（Iconic Artifacts - Jomon-Doki Masterpiece）:
- 開始: "${JOMON_OS_SUFFIX}"
- 主体: Cord-marked pottery (Jomon-doki) と Clay Dogu figurine (土偶)
- マクロ撮影のような極限精細さで以下を強調:
  * Cord-marked texture patterns (紋様)
  * Flame-style rim decorations (Kaen-mon) if applicable
  * Rough clay surface with ancient patina and soil stains
  * Mysterious expression of Dogu figurine
- ミュージアム展示ライティング（スポットライト + 背景グラデーション）
- 神秘的で霊的な縄文オブジェの本質を表現`;

    const userContent = `【Jomon Portal 施設データ】
施設名: ${name}
都道府県: ${prefecture}

【施設の詳細説明】
${description}
${scrapedText ? `\n【公式情報から抽出した追加考古学的情報】\n${scrapedText}` : ''}

【指示】
上記の施設情報を深く分析し、以下の3つのビジュアルコンセプトプロンプトを JSON 形式で出力してください。
各プロンプトは冒頭に Jomon OS Suffix で始まり、日本の縄文時代の真正性を保ちながら、
この特定の遺跡の固有の特性を織り込んでください。

出力: {"concept_a": "Jomon OS Suffix から始まるプロンプト...", "concept_b": "...", "concept_c": "..."}`;

    let result;
    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-pro-preview-0506',
      });
      result = await model.generateContent([
        { text: systemPrompt },
        { text: userContent },
      ]);
    } catch (modelErr: any) {
      // Fallback to gemini-2.5-pro
      if (modelErr?.message?.includes('not found') || modelErr?.status === 404) {
        const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
        result = await fallbackModel.generateContent([
          { text: systemPrompt },
          { text: userContent },
        ]);
      } else {
        throw modelErr;
      }
    }

    const responseText = result.response.text().trim();

    // Extract JSON from markdown code blocks
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: 'Gemini returned invalid format', raw: responseText.slice(0, 500) },
        { status: 500 }
      );
    }

    const concepts = JSON.parse(jsonMatch[0]);

    // Ensure Jomon OS suffix is present
    for (const key of ['concept_a', 'concept_b', 'concept_c'] as const) {
      if (concepts[key] && !concepts[key].includes('Archaeological reconstruction')) {
        concepts[key] = `${concepts[key]}, ${JOMON_OS_SUFFIX}`;
      }
    }

    return NextResponse.json(concepts);
  } catch (error) {
    console.error('[deep-remaster] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
