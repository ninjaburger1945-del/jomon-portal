import { NextResponse, NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as cheerio from 'cheerio';

const JOMON_OS_SUFFIX_V2_2 =
  'Centered subject with natural vertical proportions, 16:9 wide-angle composition with environmental context, NO stretching or warping of artifacts. Strictly Jomon period Japan. No Yayoi/Kofun. Cinematic lighting, gritty textures, raw documentary style.';

export async function POST(request: NextRequest) {
  try {
    const { facilityId, url, description, name, prefecture } = await request.json();

    if (!facilityId || !description) {
      return NextResponse.json(
        { error: 'facilityId and description are required' },
        { status: 400 }
      );
    }

    // Scrape URL with 10 second timeout + extract images
    let scrapedText = '';
    let imageContext = '';
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

          // Extract image metadata
          const images: { alt: string; src: string }[] = [];
          $('img').each((_, el) => {
            const $img = $(el);
            const alt = $img.attr('alt') || '';
            const src = $img.attr('src') || '';
            if (alt || src) {
              images.push({ alt, src: src.slice(0, 100) });
            }
          });

          if (images.length > 0) {
            imageContext = `Visual elements found: ${images
              .slice(0, 5)
              .map((img) => `[${img.alt || 'image'}]`)
              .join(', ')}`;
          }

          $('script, style, nav, footer, header').remove();
          scrapedText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 4000);
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

    // Helper function for Gemini API calls with retry logic for 503 errors
    const callGeminiWithRetry = async (
      model: any,
      content: any,
      maxRetries: number = 3
    ): Promise<any> => {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          return await model.generateContent(content);
        } catch (err: any) {
          const status = err?.status || err?.message;
          const is503 = status === 503 || err?.message?.includes('Service Unavailable');

          if (is503 && attempt < maxRetries - 1) {
            // Wait with exponential backoff: 2s, 4s, 8s
            const waitTime = 2000 * Math.pow(2, attempt);
            console.log(`[deep-remaster] 503 error, retrying in ${waitTime}ms...`);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
            continue;
          }
          throw err;
        }
      }
    };

    const systemPrompt = `You are an archaeological specialist for Jomon period Japan ONLY.

CRITICAL FILTERING RULE:
If input contains multiple historical periods (Yayoi, Kofun, Edo, etc), EXTRACT AND USE JOMON ELEMENTS ONLY.
Ignore all non-Jomon data completely.

STRICTLY FORBIDDEN elements:
Elevated storehouses, metal objects (bronze, iron, mirrors, swords), keyhole-shaped mounds, wet-rice paddies, tunic-style clothing, fortified structures, castles, any evidence of later cultures.

MANDATORY JOMON elements:
Sunken-floor pithouses (Tateana-jukyo, circular or rectangular), cord-marked pottery (Jomon-doki), stone tools (Sekki), clay figurines (Dogu), shell middens (Kaizuka), broadleaf forest, hearth fires.

OUTPUT FORMAT:
{"concept_a":"...", "concept_b":"...", "concept_c":"..."}

---CONCEPT DEFINITIONS (Strict Temporal Separation)---

concept_a - ANCIENT DAILY LIFE (太古の日常):
Jomon settlement ~10,000 years ago. MUST include people engaged in hunting, gathering, cooking. Multiple pithouses with smoke rising, hearth fires, cord-marked pottery visible, stone tools in use. People and pottery must maintain NATURAL PROPORTIONS—no stretching. Raw, alive with human activity. Dense primitive forest. Dawn or dusk dramatic lighting. Active human presence is MANDATORY. 16:9 composition should fill width with environmental depth and multiple figures, NOT by warping any artifacts.
Start with: "${JOMON_OS_SUFFIX_V2_2}"

concept_b - MODERN ARCHAEOLOGICAL SITE (現代の史跡):
Contemporary view of Jomon heritage park or museum site. NO PEOPLE. Reconstructed pithouses standing silently, centered in the frame. Moss-covered mounds, eroded earth structures, forest backdrop on both sides. Modern signage, preserved earth layers. Static, quiet, contemplative atmosphere. Use surrounding forest, earth textures, and archaeological landscape to fill 16:9 width—NOT by stretching the pithouse structure itself. Archaeological landscape showing passage of time.
Start with: "${JOMON_OS_SUFFIX_V2_2}"

concept_c - SYMBOLIC ARTIFACTS (象徴的遺物):
Museum display: cord-marked pottery vessel or Dogu figurine CENTERED in frame with NATURAL VERTICAL PROPORTIONS—NEVER stretch or warp the artifact. Dramatic spotlighting on clay surface. Macro detail of intricate cord patterns, patina, ancient soil stains. Dogu's mysterious expression. Fill the 16:9 width with museum environment: display base/platform beneath artifact, ambient gallery lighting on sides, dark background gradient. Emphasize spiritual essence of Jomon object. Cinematic museum photography—wide composition achieved through environmental depth, NOT artifact distortion.
Start with: "${JOMON_OS_SUFFIX_V2_2}"

---REQUIREMENTS---
- 100-150 words English per concept
- Realistic documentary style (NO fantasy/anime)
- MUST open each with Jomon OS v2.2 suffix
- Analyze both text AND visual materials (image alt text, visual context) to infer actual site structure
- NO contamination from later periods
- CRITICAL: All subjects (people, pottery, Dogu, pithouses) must maintain NATURAL PROPORTIONS
- Fill 16:9 width with ENVIRONMENTAL CONTEXT (forest, lighting, display environment, landscape depth)—NEVER stretch or warp the primary subject
- Composition technique: Centered subject + surrounding environmental elements, creating cinematic wide-angle effect`;

    const userContent = `Facility: ${name}, ${prefecture}
Description: ${description}
${imageContext ? `\nVisual Context: ${imageContext}` : ''}
${scrapedText ? `\nSite Info: ${scrapedText}` : ''}

Create 3 image generation prompts for Pollinations AI based on this Jomon site.
Analyze the site structure from available materials (text and visual context) to infer whether structures are circular/rectangular, pottery style intensity, etc.`;

    let result;
    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-lite',  // 推奨モデル＆軽量版
      });
      result = await callGeminiWithRetry(model, {
        contents: [
          { role: 'user', parts: [{ text: systemPrompt }, { text: userContent }] },
        ],
        tools: [],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096  // 3 concepts × 150 words を確実に出力
        }
      });
    } catch (modelErr: any) {
      // Check for 429 Quota Exceeded
      if (modelErr?.status === 429 || modelErr?.message?.includes('Quota')) {
        return NextResponse.json(
          {
            error: 'APIクォータに達しました。日本時間の17時（UTC+9）にリセットされます。または少し時間を置いてから再度お試しください。',
            code: 'QUOTA_EXCEEDED',
          },
          { status: 429 }
        );
      }
      // Fallback to gemini-2.5-flash-lite on model not found
      if (modelErr?.message?.includes('not found') || modelErr?.status === 404) {
        try {
          const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
          result = await callGeminiWithRetry(fallbackModel, {
            contents: [
              { role: 'user', parts: [{ text: systemPrompt }, { text: userContent }] },
            ],
            tools: [],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 4096  // 3 concepts × 150 words を確実に出力
            }
          });
        } catch (fallbackErr: any) {
          if (fallbackErr?.status === 429 || fallbackErr?.message?.includes('Quota')) {
            return NextResponse.json(
              {
                error: 'APIクォータに達しました。日本時間の17時（UTC+9）にリセットされます。または少し時間を置いてから再度お試しください。',
                code: 'QUOTA_EXCEEDED',
              },
              { status: 429 }
            );
          }
          throw fallbackErr;
        }
      } else {
        throw modelErr;
      }
    }

    const responseText = result.response.text().trim();

    // Extract JSON from markdown code blocks
    let jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // マークダウンブロック内にある場合を試す
      const mdMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      jsonMatch = mdMatch ? [mdMatch[1]] : null;
    }
    if (!jsonMatch) {
      return NextResponse.json(
        { error: 'Gemini returned invalid format', raw: responseText.slice(0, 500) },
        { status: 500 }
      );
    }

    const concepts = JSON.parse(jsonMatch[0]);

    // Ensure Jomon OS suffix is present
    for (const key of ['concept_a', 'concept_b', 'concept_c'] as const) {
      if (concepts[key] && !concepts[key].includes('Centered subject')) {
        concepts[key] = `${concepts[key]} ${JOMON_OS_SUFFIX_V2_2}`;
      }
    }

    return NextResponse.json(concepts);
  } catch (error) {
    console.error('[deep-remaster] Error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    const is503 = errorMsg.includes('Service Unavailable') || errorMsg.includes('503');
    const is429 = errorMsg.includes('Quota') || errorMsg.includes('429');

    if (is429) {
      return NextResponse.json(
        {
          error: 'APIクォータに達しました。日本時間の17時（UTC+9）にリセットされます。または少し時間を置いてから再度お試しください。',
          code: 'QUOTA_EXCEEDED',
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error: is503
          ? 'Gemini API が高い負荷を受けています。申し訳ありません。30秒待機してから再度🎨ボタンをクリックしてください。'
          : errorMsg,
      },
      { status: is503 ? 503 : 500 }
    );
  }
}
