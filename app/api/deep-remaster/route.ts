import { NextResponse, NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as cheerio from 'cheerio';

const JOMON_OS_SUFFIX =
  'Authentic Jomon period Japan, featuring sunken-floor pithouses with thick thatched roofs, intricate cord-marked pottery, mysterious clay Dogu, gritty prehistoric mud and earth textures, cinematic 16:9 aspect ratio, raw documentary style';

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

    const systemPrompt = `あなたは世界トップクラスの考古学専門家ビジュアルディレクターです。
縄文時代（約16,000〜3,000年前）の遺跡・博物館の視覚的再現を専門とし、
映画・ドキュメンタリーレベルのビジュアルコンセプトを生成します。

以下の縄文遺跡情報を深く分析し、Pollinations AI（Flux モデル）向けの
画像生成プロンプトを3つのコンセプトで英語で作成してください。

【制約】
- 出力は必ず JSON のみ: {"concept_a": "...", "concept_b": "...", "concept_c": "..."}
- 各プロンプトは英語で100〜200ワード
- 16:9アスペクト比（横長）に最適化
- リアリスティック・ドキュメンタリースタイル（アニメ・CG風禁止）
- 各プロンプトの末尾に必ず以下を付与:
  "${JOMON_OS_SUFFIX}"

【3コンセプトの絶対条件】

concept_a（Historical Reconstruction）:
- 必須要素: Sunken-floor pithouse (Tateana-jukyo) + Thatched roof of kaya grass で地面から屋根が生えているような形態
- Cord-marked pottery を空間のどこかに配置
- 夜明けか夕暮れのドラマチックな光で再現
- 集落全景のスケール感を強調

concept_b（Modern Site Environment）:
- 必須要素: Sunken-floor pithouse (Tateana-jukyo) + Thatched roof of kaya grass を環境に含める
- Cord-marked pottery を背景やフォアグラウンドに配置
- 遺跡固有の環境（lake bottom, shell mound, muddy terrain, obsidian など）と融合
- 自然と人間活動の痕跡が共存する場面

concept_c（Iconic Artifacts）:
- 必須要素: Cord-marked pottery（詳細な紋様を強調）、Flame-style rim decorations、Clay Dogu figurine
- マクロ撮影のような高精細さで、質感と細部を極限まで描写
- ミュージアム展示のドラマチックなライティング
- 神秘的な縄文オブジェの本質を表現`;

    const userContent = `【施設情報】
施設名: ${name}
都道府県: ${prefecture}
説明: ${description}
${scrapedText ? `\n【公式サイトから取得した追加情報】\n${scrapedText}` : ''}

上記情報を基に、3つのビジュアルコンセプトプロンプトを JSON で出力してください。`;

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
